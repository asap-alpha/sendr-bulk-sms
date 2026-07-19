import { computed, reactive } from 'vue'
import { api } from '@/lib/api'

/**
 * Sender IDs (the alphanumeric "from" name recipients see). On Sendr a business can hold
 * SEVERAL approved sender IDs; each goes through request → pending → approved | rejected.
 * Backed by GET /api/sms/sender-id/list. Approval is admin-side (no client controls).
 */
export type SenderIdStatus = 'pending' | 'approved' | 'rejected'

export interface SenderId {
  id: string
  name: string
  purpose: string
  sample: string
  status: SenderIdStatus
  createdAt: number
  reviewedAt: number | null
  rejectionReason?: string
}

/** Carrier rules for a valid sender ID. Returns an error string, or null if OK. */
export function validateSenderId(name: string): string | null {
  const v = name.trim()
  if (!v) return 'Enter a sender ID.'
  if (!/^[A-Za-z0-9]+$/.test(v)) return 'Letters and numbers only — no spaces or symbols.'
  if (v.length < 3) return 'At least 3 characters.'
  if (v.length > 11) return 'Maximum 11 characters.'
  if (!/[A-Za-z]/.test(v)) return 'Must contain at least one letter.'
  return null
}

/**
 * Ghana Card (KYC) format, mirroring the server's GhanaCard.Normalize — which accepts
 * lowercase, spaces, missing hyphens, or a bare 10 digits. Deliberately no stricter than
 * the server, or we'd reject input it would have taken and leave the merchant with an
 * error they can't act on. Lives beside validateSenderId so there is ONE rule per field.
 *
 * Returns an error string, or null when acceptable. An EMPTY value returns null —
 * whether the field is required depends on what's already on file, so that's the
 * caller's call.
 */
export function validateGhanaCard(value: string): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^GHA/, '')
  return /^\d{10}$/.test(compact) ? null : 'Enter it as GHA-123456789-0.'
}

// Backend shapes.
interface SenderIdRequestDoc {
  id: string
  senderId: string
  purpose: string
  status: string
  rejectionReason: string
  createdAt: string
  reviewedAt: string | null
}
interface SenderIdListResponse {
  requests: SenderIdRequestDoc[]
  approved: string[]
}

/** GET /api/sms/sender-id. Booleans only — the server never returns the card number. */
interface SenderIdStatusResponse {
  hasGhanaCard: boolean
  hasPhone: boolean
}

function mapRequest(r: SenderIdRequestDoc): SenderId {
  const status: SenderIdStatus =
    r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'
  return {
    id: r.id || r.senderId,
    name: r.senderId,
    purpose: r.purpose || '',
    sample: '', // not persisted server-side
    status,
    createdAt: r.createdAt ? Date.parse(r.createdAt) : Date.now(),
    reviewedAt: r.reviewedAt ? Date.parse(r.reviewedAt) : null,
    rejectionReason: r.rejectionReason || undefined,
  }
}

const state = reactive<{
  items: SenderId[]
  approvedNames: string[]
  loaded: boolean
  /** KYC already on file. Drives whether the request form asks — we capture once. */
  hasGhanaCard: boolean
  hasPhone: boolean
}>({
  items: [],
  approvedNames: [],
  loaded: false,
  // Default TRUE so a failed/slow status call hides the fields rather than asking for
  // details we may already hold. The server is the real gate — it rejects the request
  // if the card is genuinely missing, and the error surfaces in the form.
  hasGhanaCard: true,
  hasPhone: true,
})

async function refresh() {
  // Both reads in parallel — the status call is what tells us whether to ask for KYC,
  // and blocking the list on it would slow the screen for everyone who's already done it.
  const [payload, status] = await Promise.all([
    api.get<SenderIdListResponse>('/api/sms/sender-id/list'),
    api.get<SenderIdStatusResponse>('/api/sms/sender-id').catch(() => null),
  ])
  state.items = (payload?.requests ?? []).map(mapRequest)
  state.approvedNames = payload?.approved ?? []
  if (status) {
    state.hasGhanaCard = status.hasGhanaCard === true
    state.hasPhone = status.hasPhone === true
  }
  state.loaded = true
}

// First-load barrier for the router guard, which runs before AppLayout mounts and so
// can't wait on the layout's own refresh. De-duped: concurrent callers share one request.
let readyPromise: Promise<void> | null = null
export function senderIdsReady(): Promise<void> {
  // Swallow the error deliberately — a failed lookup leaves `loaded` false, and the
  // onboarding gate treats "don't know" as "don't redirect" rather than trapping the user.
  readyPromise ??= refresh().catch(() => {})
  return readyPromise
}

/** Drop the cached list on sign-out so the next user doesn't inherit it. */
export function resetSenderIds() {
  state.items = []
  state.approvedNames = []
  state.loaded = false
  // Back to the "don't ask" default, not to the previous user's answer — this is
  // module-level state, so leaving it would show the next person a form shaped by
  // whether the LAST person had a Ghana Card on file.
  state.hasGhanaCard = true
  state.hasPhone = true
  readyPromise = null
}

/**
 * Whether this account has any sender ID at all, in any status (including a rejected or
 * still-pending request, and admin-granted approvals that never had a request row).
 * False here is what sends a new user to the request screen first.
 */
export function hasAnySenderId(): boolean {
  return state.items.length > 0 || state.approvedNames.length > 0
}

export function senderIdsLoaded(): boolean {
  return state.loaded
}

export function useSenderIds() {

  // Submit a new sender-ID request. The backend rejects a duplicate of an id that is already
  // pending/approved, so any error is surfaced to the caller.
  async function request(input: {
    name: string
    purpose: string
    sample: string
    ghanaCardNumber?: string
    phone?: string
  }) {
    await api.post('/api/sms/sender-id', {
      senderId: input.name.trim(),
      purpose: input.purpose.trim(),
      // KYC — the NCA requires an identity behind a sender name. Sent only when we
      // don't already hold them; the server ignores a value it already has on file.
      ghanaCardNumber: input.ghanaCardNumber?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
    })
    await refresh()
  }

  /**
   * Submit KYC on its own, with no sender-ID request wrapped around it. This is the only
   * capture path for an account that signed up on Sendr before the requirement: their
   * sender ID is already requested or approved, so the request form — which is where the
   * fields otherwise live — will never be shown to them again.
   *
   * Nothing on the server rescues these accounts either. The taxId fallback reads business
   * settings, which a Sendr signup never creates, and the mobile resolver looks in profile
   * settings and worker records, which they have neither of. Asking here is the only way.
   */
  async function submitKyc(input: { ghanaCardNumber?: string; phone?: string }) {
    await api.post('/api/sms/sender-id/kyc', {
      ghanaCardNumber: input.ghanaCardNumber?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
    })
    await refresh()
  }

  // Delete one of the business's own sender-ID records (any status). If it was the active
  // approved id, the backend repoints sending to another approved id (or none).
  async function remove(id: string) {
    await api.del(`/api/sms/sender-id/${encodeURIComponent(id)}`)
    await refresh()
  }

  // True when this exact id is already pending/approved (a new request would be rejected).
  function exists(name: string): boolean {
    const n = name.trim().toLowerCase()
    return state.items.some((i) => i.name.toLowerCase() === n && i.status !== 'rejected')
  }

  // Every sendable sender ID (mapped from the backend's approved set — covers ids granted
  // via a request as well as any admin direct-set ones), for the compose picker.
  const approved = computed<SenderId[]>(() =>
    state.approvedNames.map((name) => {
      const match = state.items.find((i) => i.name.toLowerCase() === name.toLowerCase() && i.status === 'approved')
      return (
        match ?? {
          id: name,
          name,
          purpose: '',
          sample: '',
          status: 'approved' as const,
          createdAt: Date.now(),
          reviewedAt: null,
        }
      )
    }),
  )

  return {
    items: computed(() => state.items),
    approved,
    pending: computed(() => state.items.filter((i) => i.status === 'pending')),
    loaded: computed(() => state.loaded),
    // Whether the request form still needs to ask for KYC. Capture once: a merchant
    // who already gave us these — here, in TailoredFlow, or via a worker invite on the
    // same login — is never asked again.
    needsGhanaCard: computed(() => !state.hasGhanaCard),
    needsPhone: computed(() => !state.hasPhone),
    // KYC is owed. Deliberately NOT scoped to whether they hold a sender ID: identity
    // capture is its own thing, and gating it on having a pending/approved one forced a
    // merchant to REQUEST A SENDER ID they didn't want just to submit documents they
    // already had. If a detail is missing we ask for it, whatever else is in flight.
    needsKyc: computed(() => !state.hasGhanaCard || !state.hasPhone),
    refresh,
    request,
    submitKyc,
    remove,
    exists,
  }
}
