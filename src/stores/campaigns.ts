import { computed, reactive } from 'vue'
import { api } from '@/lib/api'

/**
 * Campaigns store, backed by api/sms/campaigns. `refresh()` loads the list; `create()` sends
 * a new campaign (backend computes cost, reserves credit, queues dispatch — or holds it for
 * review). Delivery stats come from the backend's per-campaign counters.
 */
export type CampaignStatus = 'sent' | 'scheduled' | 'sending' | 'failed' | 'pending' | 'rejected'

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
  rejectionReason?: string
}

// Backend SmsCampaign (camelCase JSON).
interface SmsCampaign {
  id: string
  name: string
  senderId: string
  messageTemplate: string
  status: string
  totalRecipients: number
  totalParts: number
  estimatedCost: number
  actualCost: number
  deliveredCount: number
  failedCount: number
  sentCount: number
  createdAt: string
  rejectionReason?: string
}

// One create-campaign recipient (merge carries per-row Data).
export interface CampaignRecipientInput {
  phone: string
  name?: string
  data?: Record<string, string>
}

export interface CreateCampaignInput {
  name?: string
  mode: 'simple' | 'personalized' | 'merge'
  message: string
  senderId: string
  recipients: CampaignRecipientInput[]
}

function mapStatus(s: string): CampaignStatus {
  switch (s) {
    case 'completed':
    case 'partially_failed':
      return 'sent'
    case 'queued':
    case 'sending':
      return 'sending'
    case 'pending_approval':
      return 'pending'
    case 'rejected':
      return 'rejected'
    default:
      return 'failed' // failed | canceled
  }
}

function mapCampaign(c: SmsCampaign): Campaign {
  const recipients = c.totalRecipients ?? 0
  const delivered = c.deliveredCount ?? 0
  const failed = c.failedCount ?? 0
  return {
    id: c.id,
    name: c.name || 'Untitled campaign',
    senderId: c.senderId,
    message: c.messageTemplate,
    recipients,
    delivered,
    failed,
    pending: Math.max(0, recipients - delivered - failed),
    segments: recipients > 0 ? Math.max(1, Math.round((c.totalParts ?? 0) / recipients)) : (c.totalParts ?? 0),
    cost: c.actualCost > 0 ? c.actualCost : c.estimatedCost,
    status: mapStatus(c.status),
    createdAt: c.createdAt ? Date.parse(c.createdAt) : Date.now(),
    scheduledAt: null,
    rejectionReason: c.rejectionReason || undefined,
  }
}

const state = reactive<{ items: Campaign[]; loaded: boolean }>({ items: [], loaded: false })

export function useCampaigns() {
  async function refresh() {
    const list = await api.get<SmsCampaign[]>('/api/sms/campaigns')
    state.items = (list ?? []).map(mapCampaign)
    state.loaded = true
  }

  async function create(input: CreateCampaignInput): Promise<Campaign> {
    const created = await api.post<SmsCampaign>('/api/sms/campaigns', input)
    const campaign = mapCampaign(created)
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
    loaded: computed(() => state.loaded),
    totals,
    refresh,
    create,
  }
}
