<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Send, CheckCircle2, XCircle, Wallet } from 'lucide-vue-next'
import { useCampaigns } from '@/stores/campaigns'
import { formatCurrency } from '@/lib/sms'
import { formatNumber, formatDate } from '@/lib/utils'
import Badge from '@/components/ui/Badge.vue'

const campaigns = useCampaigns()
const t = campaigns.totals

onMounted(() => {
  campaigns.refresh().catch(() => {})
})

const deliveryRate = computed(() => (t.value.recipients ? Math.round((t.value.delivered / t.value.recipients) * 100) : 0))
const failRate = computed(() => (t.value.recipients ? Math.round((t.value.failed / t.value.recipients) * 100) : 0))

const stats = computed(() => [
  { label: 'Messages sent', value: formatNumber(t.value.recipients), icon: Send, tone: 'text-primary bg-primary/10' },
  { label: 'Delivered', value: `${deliveryRate.value}%`, sub: formatNumber(t.value.delivered), icon: CheckCircle2, tone: 'text-success bg-success/10' },
  { label: 'Failed', value: `${failRate.value}%`, sub: formatNumber(t.value.failed), icon: XCircle, tone: 'text-destructive bg-destructive/10' },
  { label: 'Total spend', value: formatCurrency(t.value.cost), icon: Wallet, tone: 'text-foreground bg-muted' },
])

// Sent campaigns ranked by volume for the mini bar chart.
const ranked = computed(() =>
  campaigns.items.value
    .filter((c) => c.status === 'sent')
    .slice()
    .sort((a, b) => b.recipients - a.recipients)
    .slice(0, 6),
)
const maxRecipients = computed(() => Math.max(1, ...ranked.value.map((c) => c.recipients)))

function rate(delivered: number, recipients: number) {
  return recipients ? Math.round((delivered / recipients) * 100) : 0
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Reports</h1>
      <p class="text-sm text-muted-foreground">Delivery performance across all your campaigns.</p>
    </div>

    <!-- Stat cards -->
    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="s in stats" :key="s.label" class="rounded-xl border bg-card p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted-foreground">{{ s.label }}</span>
          <span class="flex size-8 items-center justify-center rounded-lg" :class="s.tone">
            <component :is="s.icon" class="size-4" />
          </span>
        </div>
        <div class="mt-3 text-2xl font-semibold tabular-nums">{{ s.value }}</div>
        <div v-if="s.sub" class="text-xs text-muted-foreground tabular-nums">{{ s.sub }} messages</div>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <!-- Volume chart -->
      <div class="rounded-xl border bg-card p-5 shadow-sm">
        <h2 class="font-semibold">Top campaigns by volume</h2>
        <div class="mt-4 space-y-4">
          <div v-for="c in ranked" :key="c.id">
            <div class="mb-1 flex items-center justify-between text-sm">
              <span class="truncate font-medium">{{ c.name }}</span>
              <span class="tabular-nums text-muted-foreground">{{ formatNumber(c.recipients) }}</span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary" :style="{ width: (c.recipients / maxRecipients) * 100 + '%' }" />
            </div>
          </div>
          <p v-if="!ranked.length" class="text-sm text-muted-foreground">No sent campaigns yet.</p>
        </div>
      </div>

      <!-- Delivery breakdown -->
      <div class="rounded-xl border bg-card p-5 shadow-sm">
        <h2 class="font-semibold">Delivery breakdown</h2>
        <div class="mt-4 space-y-3">
          <div v-for="c in campaigns.items.value" :key="c.id" class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between text-sm">
                <span class="truncate font-medium">{{ c.name }}</span>
                <span class="text-xs text-muted-foreground">{{ formatDate(c.createdAt) }}</span>
              </div>
              <div class="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
                <div class="bg-success" :style="{ width: (c.delivered / c.recipients) * 100 + '%' }" />
                <div class="bg-destructive" :style="{ width: (c.failed / c.recipients) * 100 + '%' }" />
                <div class="bg-warning" :style="{ width: (c.pending / c.recipients) * 100 + '%' }" />
              </div>
            </div>
            <Badge :variant="rate(c.delivered, c.recipients) >= 90 ? 'success' : 'warning'" class="tabular-nums">
              {{ rate(c.delivered, c.recipients) }}%
            </Badge>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-success" /> Delivered</span>
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-destructive" /> Failed</span>
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-warning" /> Pending</span>
        </div>
      </div>
    </div>
  </div>
</template>
