import { computed, reactive } from 'vue'
import { api } from '@/lib/api'

/**
 * SMS-credit wallet (module singleton), backed by the backend `api/sms/billing` endpoints.
 * `balance` is authoritative from the wallet doc; `transactions` are the credit ledger.
 * Call `refresh()` after login and after a successful top-up.
 */
export interface Transaction {
  id: string
  type: 'topup' | 'send'
  label: string
  amount: number // positive for credit (top-up), negative for debit (send)
  at: number // epoch ms
}

// Backend shapes (camelCase JSON).
interface WalletDoc {
  balance: number
  currency: string
  totalPurchased: number
  totalSpent: number
}
interface LedgerEntry {
  id: string
  type: string // "purchase" | "campaign_debit" | "adjustment" | "test_credit"
  amount: number // signed
  balanceAfter: number
  reference: string
  note: string
  createdAt: string // ISO 8601
}

const LEDGER_LABELS: Record<string, string> = {
  purchase: 'Top-up',
  campaign_debit: 'Campaign send',
  adjustment: 'Adjustment',
  test_credit: 'Test credit',
}

function mapEntry(e: LedgerEntry): Transaction {
  return {
    id: e.id,
    type: e.amount >= 0 ? 'topup' : 'send',
    label: e.note?.trim() || LEDGER_LABELS[e.type] || e.type,
    amount: e.amount,
    at: e.createdAt ? Date.parse(e.createdAt) : Date.now(),
  }
}

const state = reactive<{ balance: number; currency: string; transactions: Transaction[]; loaded: boolean }>({
  balance: 0,
  currency: 'GHS',
  transactions: [],
  loaded: false,
})

export function useWallet() {
  async function refresh() {
    const [wallet, ledger] = await Promise.all([
      api.get<WalletDoc>('/api/sms/billing/wallet'),
      api.get<LedgerEntry[]>('/api/sms/billing/ledger'),
    ])
    state.balance = wallet?.balance ?? 0
    state.currency = wallet?.currency ?? 'GHS'
    state.transactions = (ledger ?? []).map(mapEntry)
    state.loaded = true
  }

  return {
    balance: computed(() => state.balance),
    currency: computed(() => state.currency),
    transactions: computed(() => state.transactions),
    loaded: computed(() => state.loaded),
    refresh,
  }
}
