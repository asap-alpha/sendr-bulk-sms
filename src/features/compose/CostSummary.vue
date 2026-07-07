<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Send, CalendarClock, Wallet, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import { ComposeKey } from './useCompose'
import { formatCurrency } from '@/lib/sms'
import { formatNumber } from '@/lib/utils'
import { useCampaigns } from '@/stores/campaigns'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

const store = inject(ComposeKey)!
const campaigns = useCampaigns()
const sending = ref(false)
const sent = ref<{ recipients: number; scheduled: boolean } | null>(null)

const remaining = computed(() => store.wallet.balance.value - store.totalCost.value)

async function send() {
  if (!store.canSend.value) return
  sending.value = true
  // Mock the network round-trip; the real endpoint gets wired here later.
  await new Promise((r) => setTimeout(r, 900))

  const recipients = store.validRecipients.value.length
  const scheduled = store.scheduled.value

  store.wallet.debit(store.totalCost.value, `Campaign to ${formatNumber(recipients)} recipients`)

  // Record the campaign so it shows up in Campaigns & Reports.
  const firstLine = store.message.value.trim().split('\n')[0].slice(0, 40) || 'Untitled campaign'
  campaigns.add({
    name: firstLine,
    senderId: store.senderId.value || 'Sendr',
    message: store.message.value,
    recipients,
    delivered: scheduled ? 0 : Math.round(recipients * 0.97),
    failed: scheduled ? 0 : Math.round(recipients * 0.01),
    pending: scheduled ? recipients : Math.round(recipients * 0.02),
    segments: store.billedSegments.value,
    cost: store.totalCost.value,
    status: scheduled ? 'scheduled' : 'sent',
    scheduledAt: scheduled && store.scheduleAt.value ? new Date(store.scheduleAt.value).getTime() : null,
  })

  sent.value = { recipients, scheduled }
  sending.value = false
}

function reset() {
  sent.value = null
  store.message.value = ''
  store.clearManual()
  store.clearSheet()
}
</script>

<template>
  <div class="sticky top-6 space-y-4">
    <!-- Success state -->
    <div v-if="sent" class="rounded-xl border bg-card p-6 text-center shadow-sm">
      <CheckCircle2 class="mx-auto size-10 text-success" />
      <h3 class="mt-3 text-lg font-semibold">
        {{ sent.scheduled ? 'Campaign scheduled' : 'Messages queued' }}
      </h3>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ formatNumber(sent.recipients) }} recipient{{ sent.recipients === 1 ? '' : 's' }}
        {{ sent.scheduled ? 'will receive your message at the scheduled time.' : 'are being processed.' }}
      </p>
      <Button class="mt-4 w-full" @click="reset">Compose another</Button>
    </div>

    <!-- Summary card -->
    <div v-else class="rounded-xl border bg-card shadow-sm">
      <div class="border-b px-5 py-4">
        <h3 class="font-semibold">Review & send</h3>
      </div>

      <div class="space-y-3 px-5 py-4 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Valid recipients</span>
          <span class="font-medium">{{ formatNumber(store.validRecipients.value.length) }}</span>
        </div>
        <div v-if="store.invalidCount.value" class="flex items-center justify-between">
          <span class="text-muted-foreground">Skipped (invalid)</span>
          <span class="font-medium text-destructive">{{ formatNumber(store.invalidCount.value) }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Segments / message</span>
          <span class="font-medium">{{ store.billedSegments.value }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Cost / recipient</span>
          <span class="font-medium">{{ formatCurrency(store.perRecipientCost.value) }}</span>
        </div>

        <div class="my-1 border-t" />

        <div class="flex items-center justify-between text-base">
          <span class="font-medium">Total</span>
          <span class="font-semibold">{{ formatCurrency(store.totalCost.value) }}</span>
        </div>

        <div
          class="flex items-center justify-between rounded-lg px-3 py-2"
          :class="store.sufficient.value ? 'bg-muted/60' : 'bg-destructive/10'"
        >
          <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet class="size-3.5" /> Balance after send
          </span>
          <span class="text-sm font-semibold" :class="store.sufficient.value ? '' : 'text-destructive'">
            {{ formatCurrency(remaining) }}
          </span>
        </div>

        <div v-if="!store.sufficient.value" class="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle class="mt-0.5 size-3.5 shrink-0" />
          <span>Not enough credit for this campaign. Top up to continue.</span>
        </div>
      </div>

      <!-- Scheduling -->
      <div class="border-t px-5 py-4">
        <label class="flex cursor-pointer items-center justify-between">
          <span class="flex items-center gap-2 text-sm font-medium">
            <CalendarClock class="size-4" /> Schedule for later
          </span>
          <input v-model="store.scheduled.value" type="checkbox" class="size-4 accent-[hsl(var(--primary))]" />
        </label>
        <input
          v-if="store.scheduled.value"
          v-model="store.scheduleAt.value"
          type="datetime-local"
          class="mt-3 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div class="px-5 pb-5">
        <Button class="w-full" size="lg" :disabled="!store.canSend.value || sending" @click="send">
          <template v-if="sending">Sending…</template>
          <template v-else-if="store.scheduled.value"><CalendarClock /> Schedule campaign</template>
          <template v-else><Send /> Send now</template>
        </Button>
        <p v-if="!store.canSend.value && !sending" class="mt-2 text-center text-xs text-muted-foreground">
          <template v-if="!store.validRecipients.value.length">Add at least one valid recipient.</template>
          <template v-else-if="!store.message.value.trim()">Write your message to continue.</template>
          <template v-else-if="store.messageHasEmoji.value">Remove emoji from your message.</template>
          <template v-else-if="!store.hasApprovedSender.value">Select an approved sender ID.</template>
          <template v-else-if="store.scheduled.value && !store.scheduleAt.value">Pick a date and time.</template>
          <template v-else>Resolve the warning above to send.</template>
        </p>
      </div>
    </div>

    <!-- Preview -->
    <div v-if="!sent && store.message.value.trim()" class="rounded-xl border bg-card p-4 shadow-sm">
      <div class="mb-2 flex items-center gap-2">
        <Badge variant="muted">Preview</Badge>
        <span class="text-xs text-muted-foreground">as {{ store.senderId.value || 'Sender' }}</span>
      </div>
      <div class="max-w-[85%] rounded-2xl rounded-tl-sm bg-accent px-3 py-2 text-sm text-accent-foreground">
        {{ store.previews.value[0]?.text || store.message.value }}
      </div>
    </div>
  </div>
</template>
