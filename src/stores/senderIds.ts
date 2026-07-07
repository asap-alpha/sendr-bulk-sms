import { computed, reactive } from 'vue'

/**
 * Sender IDs (the alphanumeric "from" name recipients see) must be registered
 * and approved by the carrier/aggregator before they can be used. This mock
 * store models that lifecycle: request → pending → approved | rejected.
 *
 * The compose screen only lets you send from an `approved` sender ID. Wire
 * `request`/status to the backend at the seam; `approve`/`reject` here are demo
 * helpers so you can simulate a reviewer without a backend.
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

let counter = 700
function nextId() {
  counter += 1
  return `sid_${counter}`
}

const now = Date.now()
const day = 86400000

const state = reactive<{ items: SenderId[] }>({
  items: [
    {
      id: 'sid_700',
      name: 'Sendr',
      purpose: 'Transactional alerts and one-time passwords',
      sample: 'Your Sendr verification code is 123456.',
      status: 'approved',
      createdAt: now - day * 20,
      reviewedAt: now - day * 19,
    },
    {
      id: 'sid_701',
      name: 'ECG',
      purpose: 'Utility outage and billing notifications',
      sample: 'Planned maintenance in your area Sat 6am–10am.',
      status: 'approved',
      createdAt: now - day * 15,
      reviewedAt: now - day * 14,
    },
    {
      id: 'sid_702',
      name: 'ShopGH',
      purpose: 'Marketing promotions for existing customers',
      sample: '20% off this weekend only! Use code SAVE20.',
      status: 'pending',
      createdAt: now - day * 1,
      reviewedAt: null,
    },
    {
      id: 'sid_703',
      name: 'WinBig',
      purpose: 'Promotional lottery messages',
      sample: 'You have won! Claim your prize now.',
      status: 'rejected',
      createdAt: now - day * 4,
      reviewedAt: now - day * 3,
      rejectionReason: 'Resembles a prohibited gambling/lottery category. Provide business registration to appeal.',
    },
  ],
})

export function useSenderIds() {
  function request(input: { name: string; purpose: string; sample: string }): SenderId {
    const item: SenderId = {
      id: nextId(),
      name: input.name.trim(),
      purpose: input.purpose.trim(),
      sample: input.sample.trim(),
      status: 'pending',
      createdAt: Date.now(),
      reviewedAt: null,
    }
    state.items.unshift(item)
    return item
  }

  function exists(name: string): boolean {
    return state.items.some(
      (i) => i.name.toLowerCase() === name.trim().toLowerCase() && i.status !== 'rejected',
    )
  }

  // Demo-only: simulate a reviewer's decision.
  function approve(id: string) {
    const s = state.items.find((i) => i.id === id)
    if (s) {
      s.status = 'approved'
      s.reviewedAt = Date.now()
      s.rejectionReason = undefined
    }
  }
  function reject(id: string, reason: string) {
    const s = state.items.find((i) => i.id === id)
    if (s) {
      s.status = 'rejected'
      s.reviewedAt = Date.now()
      s.rejectionReason = reason
    }
  }

  return {
    items: computed(() => state.items),
    approved: computed(() => state.items.filter((i) => i.status === 'approved')),
    pending: computed(() => state.items.filter((i) => i.status === 'pending')),
    request,
    exists,
    approve,
    reject,
  }
}
