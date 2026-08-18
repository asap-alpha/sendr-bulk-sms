import {
  computed,
  onScopeDispose,
  reactive,
  ref,
  shallowRef,
  watch,
  type InjectionKey,
} from 'vue'
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
import { useCampaigns, type CampaignEstimate, type CampaignRecipientInput } from '@/stores/campaigns'

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
  //
  // This scan is O(rows) and depends on `message`, so running it as a plain computed
  // re-rendered and re-segmented the WHOLE sheet on every keystroke — up to
  // MAX_SHEET_ROWS (50,000) renderTemplate + analyzeMessage calls per character, which
  // froze the compose screen after a large upload. It is now debounced: typing stays
  // instant against the template meter, and the full scan runs once typing pauses.
  //
  // The scan itself is still EXACT — every row, no sampling. `totalCost` is only a
  // pre-send estimate and the affordability gate (the backend computes the real charge
  // and debits server-side), but an under-estimate would still wrongly tell someone they
  // can afford a campaign, so we don't trade accuracy for speed here.
  const WORST_DEBOUNCE_MS = 250
  // Small sheets scan faster than the debounce would delay them — keep those synchronous
  // so the meter never visibly lags on a typical file.
  const WORST_SYNC_ROW_LIMIT = 500

  function scanWorst(): { info: ReturnType<typeof analyzeMessage>; text: string } {
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
  }

  const worst = shallowRef(scanWorst())
  // True while a queued rescan has not landed yet — `billedSegments`/`totalCost` are
  // momentarily stale, so `canSend` blocks until it settles rather than sending on a
  // stale estimate.
  const worstPending = ref(false)
  let worstTimer: ReturnType<typeof setTimeout> | null = null

  function flushWorst() {
    if (worstTimer !== null) {
      clearTimeout(worstTimer)
      worstTimer = null
    }
    worst.value = scanWorst()
    worstPending.value = false
  }

  watch(
    // Everything the scan reads. `sheet` is replaced wholesale on upload, so identity is
    // enough — no deep watch over 50,000 rows.
    [message, sheet, sheetActive, phoneColumn],
    () => {
      const rows = sheetActive.value && sheet.value ? sheet.value.rows.length : 0
      if (rows <= WORST_SYNC_ROW_LIMIT) {
        flushWorst()
        return
      }
      worstPending.value = true
      if (worstTimer !== null) clearTimeout(worstTimer)
      worstTimer = setTimeout(flushWorst, WORST_DEBOUNCE_MS)
    },
  )

  onScopeDispose(() => {
    if (worstTimer !== null) clearTimeout(worstTimer)
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

  // ── Server-side cost estimate ───────────────────────────────────────────
  //
  // The local figure below bills EVERY recipient at the worst-case row's segment count
  // (recipients × max_parts). The backend charges the true per-recipient sum
  // (Σ parts(rendered_i) × price — see BuildMessages), so the local number is an upper
  // bound: never an under-quote, but it can overstate a campaign whose rows vary in
  // length. POST /api/sms/campaigns/estimate runs the SAME code path as the charge, so
  // when it answers we show the exact figure instead.
  //
  // It also knows about recipients we can't detect locally — a row missing a {{column}}
  // the message references is dropped server-side — so the quoted recipient count matches
  // what actually sends.
  const campaignsStore = useCampaigns()
  const serverEstimate = shallowRef<CampaignEstimate | null>(null)
  const estimatePending = ref(false)
  const estimateError = ref('')

  const ESTIMATE_DEBOUNCE_MS = 400
  // A hung request would otherwise leave `estimatePending` true forever, and that gates
  // canSend — i.e. a stalled proxy would permanently disable the Send button. Time out and
  // fall back to the local figure instead.
  const ESTIMATE_TIMEOUT_MS = 15_000
  let estimateTimer: ReturnType<typeof setTimeout> | null = null
  let estimateAbort: AbortController | null = null
  // Guards against an out-of-order response overwriting a newer one.
  let estimateSeq = 0

  function cancelEstimate() {
    if (estimateTimer !== null) {
      clearTimeout(estimateTimer)
      estimateTimer = null
    }
    estimateAbort?.abort()
    estimateAbort = null
  }

  async function runEstimate() {
    estimateTimer = null
    const recipients = buildRecipientsPayload()
    if (!recipients.length || !message.value.trim() || !senderId.value) {
      serverEstimate.value = null
      estimatePending.value = false
      return
    }
    estimateAbort?.abort()
    const ctrl = new AbortController()
    estimateAbort = ctrl
    const seq = ++estimateSeq
    estimatePending.value = true
    estimateError.value = ''
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      ctrl.abort()
    }, ESTIMATE_TIMEOUT_MS)
    try {
      const result = await campaignsStore.estimate(
        {
          mode: sendMode.value,
          message: message.value,
          senderId: senderId.value,
          recipients,
          scheduledAt: scheduledAtISO.value,
        },
        ctrl.signal,
      )
      if (seq !== estimateSeq) return // superseded
      // A success envelope with no body would leave this undefined, which is NOT null and
      // would make costIsExact claim the local fallback figure is the exact server one.
      serverEstimate.value = result ?? null
    } catch (e) {
      if (seq !== estimateSeq) return
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      if (aborted && !timedOut) return // superseded by a newer request
      // Fall back to the local upper-bound estimate. It over-quotes rather than
      // under-quotes, so the affordability gate stays on the safe side.
      serverEstimate.value = null
      estimateError.value = timedOut
        ? 'Pricing is taking too long — showing an estimated maximum.'
        : e instanceof Error
          ? e.message
          : 'Could not price this campaign.'
    } finally {
      clearTimeout(timeout)
      if (seq === estimateSeq) estimatePending.value = false
    }
  }

  function scheduleEstimate(immediate: boolean) {
    if (estimateTimer !== null) clearTimeout(estimateTimer)
    if (immediate) {
      void runEstimate()
      return
    }
    estimatePending.value = true
    estimateTimer = setTimeout(() => void runEstimate(), ESTIMATE_DEBOUNCE_MS)
  }

  // Local upper bound — the fallback whenever the server estimate isn't available.
  const localTotalCost = computed(() =>
    campaignCost(validRecipients.value.length, billedSegments.value, pricing.pricePerPart.value),
  )

  /** True when the displayed cost is the exact server figure rather than the local bound. */
  const costIsExact = computed(() => !!serverEstimate.value)

  const perRecipientCost = computed(() => {
    const est = serverEstimate.value
    if (est && est.totalRecipients > 0) return est.estimatedCost / est.totalRecipients
    return costPerRecipient(billedSegments.value, pricing.pricePerPart.value)
  })
  const totalCost = computed(() => serverEstimate.value?.estimatedCost ?? localTotalCost.value)
  // The server decides affordability against the authoritative balance when it has spoken.
  const sufficient = computed(() =>
    serverEstimate.value ? serverEstimate.value.affordable : totalCost.value <= wallet.balance.value,
  )
  /** Recipients the backend will drop that local validation didn't catch. */
  const droppedByServer = computed(() => {
    const est = serverEstimate.value
    if (!est) return 0
    return est.invalidRecipients + est.skippedNoName
  })

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
      // Don't let a send fire against a stale cost estimate — mid-rescan locally, or
      // while the server is still pricing the campaign.
      !worstPending.value &&
      !estimatePending.value &&
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

  // Only price from step 3 (Review & send), where the cost is actually shown. The payload
  // carries every recipient — up to MAX_RECIPIENTS rows — so firing it on each keystroke
  // back in step 2 would upload the whole list over and over for a number nobody is
  // looking at yet.
  //
  // Declared here, after `step`/`sendMode`/`buildRecipientsPayload`: watch() evaluates its
  // sources immediately, so referencing those consts any earlier is a TDZ error.
  watch(
    [step, message, senderId, sendMode, validRecipients, scheduledAtISO],
    ([s], [prevStepValue]) => {
      if (s !== 3) {
        cancelEstimate()
        estimatePending.value = false
        serverEstimate.value = null
        return
      }
      // Arriving on step 3 prices immediately; edits while there are debounced.
      scheduleEstimate(prevStepValue !== 3)
    },
  )

  onScopeDispose(cancelEstimate)

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
    worstPending,
    flushWorst,
    billedSegments,
    serverEstimate,
    estimatePending,
    estimateError,
    costIsExact,
    droppedByServer,
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
