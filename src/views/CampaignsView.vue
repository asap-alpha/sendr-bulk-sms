<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, Megaphone, Plus } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { useCampaigns, type CampaignStatus } from '@/stores/campaigns'
import { formatCurrency } from '@/lib/sms'
import { formatNumber, formatDate } from '@/lib/utils'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

const campaigns = useCampaigns()
const query = ref('')
const filter = ref<'all' | CampaignStatus>('all')

const statusVariant: Record<CampaignStatus, 'success' | 'secondary' | 'warning' | 'destructive'> = {
  sent: 'success',
  scheduled: 'secondary',
  sending: 'warning',
  failed: 'destructive',
}

const filtered = computed(() =>
  campaigns.items.value.filter((c) => {
    const matchesQuery =
      !query.value.trim() ||
      c.name.toLowerCase().includes(query.value.toLowerCase()) ||
      c.senderId.toLowerCase().includes(query.value.toLowerCase())
    const matchesFilter = filter.value === 'all' || c.status === filter.value
    return matchesQuery && matchesFilter
  }),
)

const filters: Array<{ key: 'all' | CampaignStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'failed', label: 'Failed' },
]

function deliveredPct(c: { delivered: number; recipients: number }) {
  return c.recipients ? Math.round((c.delivered / c.recipients) * 100) : 0
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p class="text-sm text-muted-foreground">Everything you've sent or scheduled.</p>
      </div>
      <RouterLink :to="{ name: 'compose' }">
        <Button><Plus class="size-4" /> New campaign</Button>
      </RouterLink>
    </div>

    <!-- Controls -->
    <div class="mt-6 flex flex-wrap items-center gap-3">
      <div class="relative max-w-xs flex-1">
        <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" placeholder="Search campaigns…" class="pl-9" />
      </div>
      <div class="flex items-center gap-1 rounded-lg border bg-card p-1">
        <button
          v-for="f in filters"
          :key="f.key"
          class="rounded-md px-3 py-1 text-sm font-medium transition-colors"
          :class="filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="filter = f.key"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="!filtered.length" class="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <Megaphone class="size-8 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">No campaigns match your search.</p>
    </div>

    <!-- Table -->
    <div v-else class="mt-6 overflow-hidden rounded-xl border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th class="px-4 py-3 font-medium">Campaign</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Recipients</th>
              <th class="px-4 py-3 font-medium">Delivered</th>
              <th class="px-4 py-3 font-medium">Cost</th>
              <th class="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in filtered" :key="c.id" class="border-b last:border-0 transition-colors hover:bg-muted/40">
              <td class="px-4 py-3">
                <div class="font-medium">{{ c.name }}</div>
                <div class="max-w-xs truncate text-xs text-muted-foreground">{{ c.senderId }} · {{ c.message }}</div>
              </td>
              <td class="px-4 py-3">
                <Badge :variant="statusVariant[c.status]" class="capitalize">{{ c.status }}</Badge>
              </td>
              <td class="px-4 py-3 tabular-nums">{{ formatNumber(c.recipients) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div class="h-full rounded-full bg-success" :style="{ width: deliveredPct(c) + '%' }" />
                  </div>
                  <span class="text-xs text-muted-foreground tabular-nums">{{ deliveredPct(c) }}%</span>
                </div>
              </td>
              <td class="px-4 py-3 tabular-nums">{{ formatCurrency(c.cost) }}</td>
              <td class="px-4 py-3 text-muted-foreground">
                {{ c.status === 'scheduled' && c.scheduledAt ? formatDate(c.scheduledAt) : formatDate(c.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
