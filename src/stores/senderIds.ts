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

const state = reactive<{ items: SenderId[]; approvedNames: string[]; loaded: boolean }>({
  items: [],
  approvedNames: [],
  loaded: false,
})

export function useSenderIds() {
  async function refresh() {
    const payload = await api.get<SenderIdListResponse>('/api/sms/sender-id/list')
    state.items = (payload?.requests ?? []).map(mapRequest)
    state.approvedNames = payload?.approved ?? []
    state.loaded = true
  }

  // Submit a new sender-ID request. The backend rejects a duplicate of an id that is already
  // pending/approved, so any error is surfaced to the caller.
  async function request(input: { name: string; purpose: string; sample: string }) {
    await api.post('/api/sms/sender-id', {
      senderId: input.name.trim(),
      purpose: input.purpose.trim(),
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
    refresh,
    request,
    remove,
    exists,
  }
}
