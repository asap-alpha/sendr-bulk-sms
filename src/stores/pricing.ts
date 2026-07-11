import { computed, reactive } from 'vue'
import { api } from '@/lib/api'
import { SMS_RATE } from '@/lib/sms'

/**
 * Live SMS pricing for this platform, pulled from the backend readiness endpoint
 * (api/sms/billing/status). pricePerPart is the authoritative per-segment rate used to
 * cost campaigns; it can differ from tailoredflow's. Falls back to SMS_RATE until loaded.
 */
interface StatusResponse {
  pricePerPart: number
  minTopUp: number
  maxTopUp: number
  currency: string
}

const state = reactive({
  pricePerPart: SMS_RATE,
  minTopUp: 10,
  maxTopUp: 10000,
  currency: 'GHS',
  loaded: false,
})

export function usePricing() {
  async function refresh() {
    const s = await api.get<StatusResponse>('/api/sms/billing/status')
    if (s) {
      if (s.pricePerPart > 0) state.pricePerPart = s.pricePerPart
      if (s.minTopUp > 0) state.minTopUp = s.minTopUp
      if (s.maxTopUp > 0) state.maxTopUp = s.maxTopUp
      state.currency = s.currency || 'GHS'
    }
    state.loaded = true
  }

  return {
    pricePerPart: computed(() => state.pricePerPart),
    minTopUp: computed(() => state.minTopUp),
    maxTopUp: computed(() => state.maxTopUp),
    currency: computed(() => state.currency),
    loaded: computed(() => state.loaded),
    refresh,
  }
}
