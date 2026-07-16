import { computed, reactive, ref, type InjectionKey } from 'vue'
import {
  normalizePhone,
  splitRecipients,
  DEFAULT_COUNTRY,
  type NormalizedPhone,
} from '@/lib/phone'
import { type ParsedSheet, guessPhoneColumn, MAX_RECIPIENTS } from '@/lib/csv'
import { analyzeMessage, campaignCost, costPerRecipient } from '@/lib/sms'
import { containsEmoji } from '@/lib/emoji'
import { useWallet } from '@/stores/wallet'
import { useSenderIds } from '@/stores/senderIds'
import { usePricing } from '@/stores/pricing'
import type { CampaignRecipientInput } from '@/stores/campaigns'

export type RecipientSource = 'manual' | 'upload' | 'contacts'
/** The sources backed by a ParsedSheet — a file upload or a phone-book import. */
export type SheetSource = Exclude<RecipientSource, 'manual'>

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

  // Sheet entry — a file upload or a phone-book import. Only one sheet is held at a
  // time; sheetSource records which tab produced it.
  const sheet = ref<ParsedSheet | null>(null)
  const phoneColumn = ref<string | null>(null)
  const sheetSource = ref<SheetSource | null>(null)

  const senderIds = useSenderIds()

  const message = ref('')
  const senderId = ref(senderIds.approved.value[0]?.name ?? '')

  // Scheduling (optional). scheduleAt is a datetime-local string (local time); we convert it
  // to an absolute ISO instant for the API, which stores/compares in UTC.
  const scheduled = ref(false)
  const scheduleAt = ref('')
  // Valid when not scheduling, or scheduling a parseable time at least a minute out (matches
  // the server, which treats anything nearer than that as send-now).
  const scheduleValid = computed(
    () => !scheduled.value || (!!scheduleAt.value && new Date(scheduleAt.value).getTime() > Date.now() + 60_000),
  )
  // The instant to send at, for the create payload — undefined when sending now.
  const scheduledAtISO = computed<string | undefined>(() => {
    if (!scheduled.value || !scheduleAt.value) return undefined
    const d = new Date(scheduleAt.value)
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined
  })

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

  // ── Sheet recipients (upload / phone book) ─────────────────────────────
  function setSheet(parsed: ParsedSheet, as: SheetSource = 'upload') {
    sheet.value = parsed
    phoneColumn.value = guessPhoneColumn(parsed)
    sheetSource.value = as
    source.value = as
  }
  function clearSheet() {
    sheet.value = null
    phoneColumn.value = null
    sheetSource.value = null
  }

  // A loaded sheet only counts while its own tab is selected. Switching to another tab
  // parks it rather than dropping it, so going back doesn't lose the import.
  const sheetActive = computed(() => !!sheet.value && sheetSource.value === source.value)

  // Tokens available for the message editor (spreadsheet columns).
  const tokens = computed(() => (sheetActive.value && sheet.value ? sheet.value.headers : []))

  // Recipients from the active source, normalized.
  const recipients = computed<NormalizedPhone[]>(() => {
    if (source.value === 'manual') return manual
    if (sheetActive.value && sheet.value && phoneColumn.value) {
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
  // The authoritative limit: unique valid recipients (post-dedup) can't exceed the per-campaign
  // cap. A file with duplicates that settles under the cap is fine; this only blocks a genuinely
  // oversized list. Matches the backend's MaxRecipients check exactly.
  const tooManyRecipients = computed(() => validRecipients.value.length > MAX_RECIPIENTS)

  // Preview: message rendered against the first few data rows.
  const previews = computed(() => {
    if (sheetActive.value && sheet.value) {
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
    if (sheetActive.value && sheet.value && sheet.value.rows.length) {
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
      !tooManyRecipients.value &&
      message.value.trim().length > 0 &&
      !messageHasEmoji.value &&
      hasApprovedSender.value &&
      sufficient.value &&
      scheduleValid.value,
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
    if (sheetActive.value && sheet.value && phoneColumn.value) {
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
    sheetSource,
    message,
    senderId,
    scheduled,
    scheduleAt,
    scheduleValid,
    scheduledAtISO,
    wallet,
    // actions
    addManual,
    removeManual,
    clearManual,
    setSheet,
    clearSheet,
    // derived
    sheetActive,
    tokens,
    recipients,
    validRecipients,
    invalidCount,
    totalCount,
    tooManyRecipients,
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
