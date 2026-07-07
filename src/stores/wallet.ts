import { computed, reactive } from 'vue'

/**
 * Mock wallet (module singleton). Holds the SMS-credit balance and a ledger of
 * transactions. Top-ups credit it; sending a campaign debits it. Wire to the
 * payments/credit backend at the `credit`/`debit` seam.
 */
export interface Transaction {
  id: string
  type: 'topup' | 'send'
  label: string
  amount: number // positive for topup, negative for send
  at: number // epoch ms
}

let counter = 1000
function nextId() {
  counter += 1
  return `txn_${counter}`
}

const state = reactive<{ balance: number; transactions: Transaction[] }>({
  balance: 500,
  transactions: [
    { id: 'txn_1000', type: 'topup', label: 'Welcome bonus', amount: 500, at: Date.now() - 86400000 * 3 },
  ],
})

export function useWallet() {
  function credit(amount: number, label: string) {
    state.balance = Math.round((state.balance + amount) * 100) / 100
    state.transactions.unshift({ id: nextId(), type: 'topup', label, amount, at: Date.now() })
  }

  function debit(amount: number, label: string) {
    state.balance = Math.max(0, Math.round((state.balance - amount) * 100) / 100)
    state.transactions.unshift({ id: nextId(), type: 'send', label, amount: -amount, at: Date.now() })
  }

  return {
    balance: computed(() => state.balance),
    transactions: computed(() => state.transactions),
    credit,
    debit,
  }
}
