import { computed, reactive } from 'vue'
import { api } from '@/lib/api'
import { SMS_RATE } from '@/lib/sms'

/**
 * Live SMS pricing for this platform, pulled from the backend readiness endpoint
 * (api/sms/billing/status). pricePerPart is the authoritative per-segment rate used to
 * cost campaigns; it can differ from tailoredflow's.
 *
 * SMS_RATE is a placeholder only — it keeps the shape valid before /status answers, and is
 * NOT a usable rate. `loaded` gates that: until it flips true we have no authoritative price,
 * so callers must not render SMS counts or costs derived from it. Showing the placeholder and
 * then correcting it reads as the price changing on its own.
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

// Both AppLayout and TopUpView refresh on mount; on a hard load of /app/topup that would fire
// two identical requests. Share the in-flight one instead.
let inflight: Promise<void> | null = null

export function usePricing() {
  async function refresh() {
    if (inflight) return inflight
    inflight = (async () => {
      try {
        const s = await api.get<StatusResponse>('/api/sms/billing/status')
        if (s) {
          if (s.pricePerPart > 0) state.pricePerPart = s.pricePerPart
          if (s.minTopUp > 0) state.minTopUp = s.minTopUp
          if (s.maxTopUp > 0) state.maxTopUp = s.maxTopUp
          state.currency = s.currency || 'GHS'
          // Only an answered /status makes the rate authoritative. A failed fetch leaves
          // loaded=false so estimates stay hidden rather than quoting the placeholder.
          if (s.pricePerPart > 0) state.loaded = true
        }
      } finally {
        inflight = null
      }
    })()
    return inflight
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
