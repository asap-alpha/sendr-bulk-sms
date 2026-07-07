import { computed, reactive } from 'vue'

/**
 * Mock campaigns store (module singleton). Seeded with a few examples so the
 * Campaigns and Reports screens have data; real sends from the compose screen
 * get prepended via `add`. Delivery stats are faked for now.
 */
export type CampaignStatus = 'sent' | 'scheduled' | 'sending' | 'failed'

export interface Campaign {
  id: string
  name: string
  senderId: string
  message: string
  recipients: number
  delivered: number
  failed: number
  pending: number
  segments: number
  cost: number
  status: CampaignStatus
  createdAt: number
  scheduledAt: number | null
}

let counter = 5000
function nextId() {
  counter += 1
  return `cmp_${counter}`
}

const now = Date.now()
const day = 86400000

const state = reactive<{ items: Campaign[] }>({
  items: [
    {
      id: 'cmp_5000',
      name: 'June payday reminder',
      senderId: 'Sendr',
      message: 'Hi {{name}}, your salary advance is due on the 28th. Reply HELP for options.',
      recipients: 1240,
      delivered: 1198,
      failed: 21,
      pending: 21,
      segments: 1,
      cost: 43.4,
      status: 'sent',
      createdAt: now - day * 2,
      scheduledAt: null,
    },
    {
      id: 'cmp_5001',
      name: 'ECG outage notice',
      senderId: 'ECG',
      message: 'Planned maintenance in your area on Saturday 6am–10am. Sorry for the inconvenience.',
      recipients: 8450,
      delivered: 8102,
      failed: 348,
      pending: 0,
      segments: 1,
      cost: 295.75,
      status: 'sent',
      createdAt: now - day * 5,
      scheduledAt: null,
    },
    {
      id: 'cmp_5002',
      name: 'Weekend promo blast',
      senderId: 'ShopGH',
      message: 'Flash sale! 20% off everything this weekend only. Use code {{code}}. Shop now 🛍️',
      recipients: 3200,
      delivered: 0,
      failed: 0,
      pending: 3200,
      segments: 2,
      cost: 224,
      status: 'scheduled',
      createdAt: now - day * 1,
      scheduledAt: now + day * 2,
    },
  ],
})

export function useCampaigns() {
  function add(c: Omit<Campaign, 'id' | 'createdAt'>): Campaign {
    const campaign: Campaign = { ...c, id: nextId(), createdAt: Date.now() }
    state.items.unshift(campaign)
    return campaign
  }

  const totals = computed(() => {
    const t = { recipients: 0, delivered: 0, failed: 0, pending: 0, cost: 0 }
    for (const c of state.items) {
      t.recipients += c.recipients
      t.delivered += c.delivered
      t.failed += c.failed
      t.pending += c.pending
      t.cost += c.cost
    }
    return t
  })

  return {
    items: computed(() => state.items),
    totals,
    add,
  }
}
