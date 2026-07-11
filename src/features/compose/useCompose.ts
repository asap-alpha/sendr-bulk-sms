import { computed, reactive, ref, type InjectionKey } from 'vue'
import {
  normalizePhone,
  splitRecipients,
  DEFAULT_COUNTRY,
  type NormalizedPhone,
} from '@/lib/phone'
import { type ParsedSheet, guessPhoneColumn } from '@/lib/csv'
import { analyzeMessage, campaignCost, costPerRecipient } from '@/lib/sms'
import { containsEmoji } from '@/lib/emoji'
import { useWallet } from '@/stores/wallet'
import { useSenderIds } from '@/stores/senderIds'
import { usePricing } from '@/stores/pricing'
import type { CampaignRecipientInput } from '@/stores/campaigns'

export type RecipientSource = 'manual' | 'upload'

/**
 * Render a template's {{tokens}} against a row of spreadsheet data.
 * Unknown tokens are left visible so the user notices a bad merge field.
 */
export function renderTemplate(template: string, row: Record<string, string>): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, key: string) => {
    const k = key.trim()
    return k in row ? row[k] : `{{${k}}}`
  })
}

export function createCompose() {
  const source = ref<RecipientSource>('manual')
  const defaultCountry = ref(DEFAULT_COUNTRY)

  // Manual entry: list of normalized chips.
  const manual = reactive<NormalizedPhone[]>([])

  // Upload entry.
  const sheet = ref<ParsedSheet | null>(null)
  const phoneColumn = ref<string | null>(null)

  const senderIds = useSenderIds()

  const message = ref('')
  const senderId = ref(senderIds.approved.value[0]?.name ?? '')

  // Scheduling (optional).
  const scheduled = ref(false)
  const scheduleAt = ref('') // datetime-local string

  // Shared wallet + live pricing (app-wide singletons).
  const wallet = useWallet()
  const pricing = usePricing()

  // ── Manual recipients ──────────────────────────────────────────────────
  function addManual(blob: string) {
    const existing = new Set(manual.map((m) => m.e164 ?? m.raw))
    for (const part of splitRecipients(blob)) {
      const p = normalizePhone(part, defaultCountry.value)
      const key = p.e164 ?? p.raw
      if (existing.has(key)) continue
      existing.add(key)
      manual.push(p)
    }
  }
  function removeManual(index: number) {
    manual.splice(index, 1)
  }
  function clearManual() {
    manual.splice(0, manual.length)
  }

  // ── Upload recipients ──────────────────────────────────────────────────
  function setSheet(parsed: ParsedSheet) {
    sheet.value = parsed
    phoneColumn.value = guessPhoneColumn(parsed)
    source.value = 'upload'
  }
  function clearSheet() {
    sheet.value = null
    phoneColumn.value = null
  }

  // Tokens available for the message editor (spreadsheet columns).
  const tokens = computed(() => (source.value === 'upload' && sheet.value ? sheet.value.headers : []))

  // Recipients from the active source, normalized.
  const recipients = computed<NormalizedPhone[]>(() => {
    if (source.value === 'manual') return manual
    if (sheet.value && phoneColumn.value) {
      const seen = new Set<string>()
      const out: NormalizedPhone[] = []
      for (const row of sheet.value.rows) {
        const p = normalizePhone(row[phoneColumn.value] ?? '', defaultCountry.value)
        const key = p.e164 ?? p.raw
        if (key && seen.has(key)) continue
        if (key) seen.add(key)
        out.push(p)
      }
      return out
    }
    return []
  })

  const validRecipients = computed(() => recipients.value.filter((r) => r.valid))
  const invalidCount = computed(() => recipients.value.length - validRecipients.value.length)
  const totalCount = computed(() => recipients.value.length)

  // Preview: message rendered against the first few data rows.
  const previews = computed(() => {
    if (source.value === 'upload' && sheet.value) {
      return sheet.value.rows.slice(0, 3).map((row) => ({
        to: phoneColumn.value ? row[phoneColumn.value] : '',
        text: renderTemplate(message.value, row),
      }))
    }
    return [{ to: manual[0]?.raw ?? '', text: message.value }]
  })

  // Worst-case segmentation: the row that renders to the most segments drives
  // the billed cost, so we surface that — not the raw template.
  const worst = computed(() => {
    if (source.value === 'upload' && sheet.value && sheet.value.rows.length) {
      let worstInfo = analyzeMessage(message.value)
      let worstText = message.value
      for (const row of sheet.value.rows) {
        const text = renderTemplate(message.value, row)
        const info = analyzeMessage(text)
        if (info.segments > worstInfo.segments) {
          worstInfo = info
          worstText = text
        }
      }
      return { info: worstInfo, text: worstText }
    }
    return { info: analyzeMessage(message.value), text: message.value }
  })

  // The raw template as typed (tokens counted literally).
  const templateInfo = computed(() => analyzeMessage(message.value))

  // True once merge fields will actually pull in row data.
  const usesMergeData = computed(
    () => tokens.value.length > 0 && (sheet.value?.rows.length ?? 0) > 0 && /\{\{[^}]+\}\}/.test(message.value),
  )

  // What the live meter should show: the real merged message (longest row) when
  // merge fields are in play, otherwise the template as typed. This is what the
  // recipient actually receives — and what we bill.
  const meterInfo = computed(() => (usesMergeData.value ? worst.value.info : templateInfo.value))

  const billedSegments = computed(() => Math.max(templateInfo.value.segments, worst.value.info.segments))
  const perRecipientCost = computed(() => costPerRecipient(billedSegments.value, pricing.pricePerPart.value))
  const totalCost = computed(() => campaignCost(validRecipients.value.length, billedSegments.value, pricing.pricePerPart.value))
  const sufficient = computed(() => totalCost.value <= wallet.balance.value)

  const hasApprovedSender = computed(() => senderIds.approved.value.some((s) => s.name === senderId.value))

  // Emoji aren't allowed — they force UCS-2 and inflate cost. Block on the template.
  const messageHasEmoji = computed(() => containsEmoji(message.value))

  const canSend = computed(
    () =>
      validRecipients.value.length > 0 &&
      message.value.trim().length > 0 &&
      !messageHasEmoji.value &&
      hasApprovedSender.value &&
      sufficient.value &&
      (!scheduled.value || !!scheduleAt.value),
  )

  // ── Stepper ────────────────────────────────────────────────────────────
  // The compose flow is a 3-step wizard: Recipients → Message → Review & send.
  const step = ref<1 | 2 | 3>(1)
  // Set once a campaign is sent, so the view can swap the wizard for a success screen.
  const completed = ref(false)
  const recipientsReady = computed(() => validRecipients.value.length > 0)
  const messageReady = computed(
    () => message.value.trim().length > 0 && !messageHasEmoji.value && hasApprovedSender.value,
  )

  function goToStep(n: 1 | 2 | 3) {
    if (n === step.value) return
    // Going back is always allowed; going forward requires prior steps to be ready.
    if (n > step.value) {
      if (n >= 2 && !recipientsReady.value) return
      if (n >= 3 && !messageReady.value) return
    }
    step.value = n
  }
  function nextStep() {
    if (step.value < 3) goToStep((step.value + 1) as 1 | 2 | 3)
  }
  function prevStep() {
    if (step.value > 1) step.value = (step.value - 1) as 1 | 2 | 3
  }

  // Send mode: an uploaded sheet whose message uses {{column}} fields merges per row;
  // everything else sends the message verbatim.
  const sendMode = computed<'simple' | 'merge'>(() => (usesMergeData.value ? 'merge' : 'simple'))

  // Build the recipients payload for the create endpoint. Manual entry sends bare numbers;
  // an upload sends each valid, de-duped number plus its full row (columns) for {{merge}}.
  function buildRecipientsPayload(): CampaignRecipientInput[] {
    if (source.value === 'manual') {
      return validRecipients.value.map((r) => ({ phone: r.e164 ?? r.raw }))
    }
    if (sheet.value && phoneColumn.value) {
      const seen = new Set<string>()
      const out: CampaignRecipientInput[] = []
      for (const row of sheet.value.rows) {
        const p = normalizePhone(row[phoneColumn.value] ?? '', defaultCountry.value)
        if (!p.valid) continue
        const key = p.e164 ?? p.raw
        if (!key || seen.has(key)) continue
        seen.add(key)
        out.push({ phone: key, data: { ...row } })
      }
      return out
    }
    return []
  }

  return {
    // state
    source,
    defaultCountry,
    manual,
    sheet,
    phoneColumn,
    message,
    senderId,
    scheduled,
    scheduleAt,
    wallet,
    // actions
    addManual,
    removeManual,
    clearManual,
    setSheet,
    clearSheet,
    // derived
    tokens,
    recipients,
    validRecipients,
    invalidCount,
    totalCount,
    previews,
    templateInfo,
    usesMergeData,
    meterInfo,
    worst,
    billedSegments,
    perRecipientCost,
    totalCost,
    sufficient,
    hasApprovedSender,
    messageHasEmoji,
    canSend,
    sendMode,
    buildRecipientsPayload,
    // stepper
    step,
    completed,
    recipientsReady,
    messageReady,
    goToStep,
    nextStep,
    prevStep,
  }
}

export type ComposeStore = ReturnType<typeof createCompose>
export const ComposeKey: InjectionKey<ComposeStore> = Symbol('compose')
