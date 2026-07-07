<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ArrowUpRight, ArrowDownLeft } from 'lucide-vue-next'
import { useWallet } from '@/stores/wallet'
import { CURRENCY, formatCurrency, SMS_RATE } from '@/lib/sms'
import { formatNumber, timeAgo } from '@/lib/utils'
import { normalizePhone } from '@/lib/phone'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/Badge.vue'

const wallet = useWallet()

// Mobile money is the only payment method — one card per network.
type NetworkId = 'mtn' | 'telecel' | 'at'
const networks: Array<{ id: NetworkId; name: string; short: string; classes: string }> = [
  { id: 'mtn', name: 'MTN MoMo', short: 'MTN', classes: 'bg-[#FFCC00] text-black' },
  { id: 'telecel', name: 'Telecel Cash', short: 'TEL', classes: 'bg-[#E4002B] text-white' },
  { id: 'at', name: 'AT Money', short: 'AT', classes: 'bg-[#003DA5] text-white' },
]

const packages = [50, 100, 250, 500, 1000]
const selected = ref<number | null>(100)
const custom = ref('')
const network = ref<NetworkId>('mtn')
const momoNumber = ref('')
const processing = ref(false)
const done = ref<number | null>(null)

const amount = computed(() => {
  if (custom.value.trim()) {
    const n = Number(custom.value)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return selected.value ?? 0
})

// Rough guide: how many single-segment SMS this buys.
const estSms = computed(() => Math.floor(amount.value / SMS_RATE))

const momoValid = computed(() => normalizePhone(momoNumber.value).valid)
const activeNetwork = computed(() => networks.find((n) => n.id === network.value)!)
const canPay = computed(() => amount.value > 0 && momoValid.value && !processing.value)

function pick(v: number) {
  selected.value = v
  custom.value = ''
}

async function pay() {
  if (!canPay.value) return
  processing.value = true
  await new Promise((r) => setTimeout(r, 1000))
  wallet.credit(amount.value, `${activeNetwork.value.name} top-up`)
  done.value = amount.value
  processing.value = false
}

function again() {
  done.value = null
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Top up credit</h1>
      <p class="text-sm text-muted-foreground">Add SMS credit to your wallet. 1 credit ≈ 1 message segment.</p>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      <!-- Top-up form -->
      <div class="rounded-xl border bg-card p-6 shadow-sm">
        <template v-if="done === null">
          <h2 class="text-sm font-medium">Choose an amount ({{ CURRENCY }})</h2>
          <div class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
            <button
              v-for="p in packages"
              :key="p"
              class="rounded-lg border py-3 text-center transition-colors"
              :class="selected === p && !custom ? 'border-primary bg-accent text-accent-foreground ring-1 ring-primary' : 'hover:border-primary/50'"
              @click="pick(p)"
            >
              <div class="font-semibold">{{ p }}</div>
              <div class="text-xs text-muted-foreground">{{ formatNumber(Math.floor(p / SMS_RATE)) }} SMS</div>
            </button>
          </div>

          <div class="mt-4 grid gap-1.5">
            <label class="text-sm font-medium">Or enter a custom amount</label>
            <div class="relative max-w-xs">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{{ CURRENCY }}</span>
              <Input v-model="custom" type="number" placeholder="0.00" class="pl-12" />
            </div>
          </div>

          <h2 class="mt-6 text-sm font-medium">Mobile money network</h2>
          <div class="mt-3 grid gap-3 sm:grid-cols-3">
            <button
              v-for="n in networks"
              :key="n.id"
              class="relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
              :class="network === n.id ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'"
              @click="network = n.id"
            >
              <span class="flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-bold" :class="n.classes">
                {{ n.short }}
              </span>
              <span class="text-sm font-medium">{{ n.name }}</span>
              <Check v-if="network === n.id" class="absolute right-2 top-2 size-4 text-primary" />
            </button>
          </div>

          <div class="mt-4 grid gap-1.5">
            <label class="text-sm font-medium">{{ activeNetwork.name }} number</label>
            <Input v-model="momoNumber" type="tel" placeholder="e.g. 024 123 4567" class="max-w-xs" />
            <p v-if="momoNumber && !momoValid" class="text-xs text-destructive">Enter a valid Ghana mobile number.</p>
            <p v-else class="text-xs text-muted-foreground">You'll get a prompt on this number to approve the payment.</p>
          </div>

          <div class="mt-6 flex items-center justify-between border-t pt-4">
            <div>
              <div class="text-sm text-muted-foreground">You'll pay</div>
              <div class="text-2xl font-semibold">{{ formatCurrency(amount) }}</div>
              <div class="text-xs text-muted-foreground">≈ {{ formatNumber(estSms) }} single-segment SMS</div>
            </div>
            <Button size="lg" :disabled="!canPay" @click="pay">
              {{ processing ? 'Processing…' : `Pay ${formatCurrency(amount)}` }}
            </Button>
          </div>
        </template>

        <!-- Success -->
        <div v-else class="flex flex-col items-center py-8 text-center">
          <div class="flex size-14 items-center justify-center rounded-full bg-success/15">
            <Check class="size-7 text-success" />
          </div>
          <h2 class="mt-4 text-lg font-semibold">Top-up successful</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ formatCurrency(done) }} added. New balance is {{ formatCurrency(wallet.balance.value) }}.
          </p>
          <Button class="mt-5" variant="outline" @click="again">Top up again</Button>
        </div>
      </div>

      <!-- Balance + history -->
      <div class="space-y-4">
        <div class="rounded-xl border bg-primary p-5 text-primary-foreground shadow-sm">
          <div class="text-sm text-primary-foreground/80">Current balance</div>
          <div class="mt-1 text-3xl font-semibold">{{ wallet.balance.value.toFixed(2) }}</div>
          <div class="text-sm text-primary-foreground/80">credits</div>
        </div>

        <div class="rounded-xl border bg-card p-5 shadow-sm">
          <h3 class="text-sm font-semibold">Recent activity</h3>
          <ul class="mt-3 space-y-3">
            <li v-for="tx in wallet.transactions.value.slice(0, 8)" :key="tx.id" class="flex items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full"
                :class="tx.amount >= 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'"
              >
                <ArrowDownLeft v-if="tx.amount >= 0" class="size-4" />
                <ArrowUpRight v-else class="size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{{ tx.label }}</div>
                <div class="text-xs text-muted-foreground">{{ timeAgo(tx.at) }}</div>
              </div>
              <Badge :variant="tx.amount >= 0 ? 'success' : 'muted'" class="tabular-nums">
                {{ tx.amount >= 0 ? '+' : '' }}{{ tx.amount.toFixed(2) }}
              </Badge>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
