<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Send, CalendarClock, Wallet, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import { ComposeKey } from './useCompose'
import { formatCurrency } from '@/lib/sms'
import { formatNumber } from '@/lib/utils'
import { useCampaigns } from '@/stores/campaigns'
import { ApiError } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

const store = inject(ComposeKey)!
const campaigns = useCampaigns()
const sending = ref(false)
const sent = ref<{ recipients: number; review: boolean } | null>(null)
const error = ref('')

const remaining = computed(() => store.wallet.balance.value - store.totalCost.value)

async function send() {
  if (!store.canSend.value) return
  sending.value = true
  error.value = ''
  try {
    const recipients = store.buildRecipientsPayload()
    const firstLine = store.message.value.trim().split('\n')[0].slice(0, 40) || 'Untitled campaign'
    const campaign = await campaigns.create({
      name: firstLine,
      mode: store.sendMode.value,
      message: store.message.value,
      senderId: store.senderId.value,
      recipients,
    })
    // Balance was debited server-side; pull the fresh figure.
    await store.wallet.refresh()
    sent.value = { recipients: campaign.recipients || recipients.length, review: campaign.status === 'pending' }
    store.completed.value = true
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not send the campaign. Please try again.'
  } finally {
    sending.value = false
  }
}

function reset() {
  sent.value = null
  error.value = ''
  store.message.value = ''
  store.clearManual()
  store.clearSheet()
  store.completed.value = false
  store.goToStep(1)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Success state -->
    <div v-if="sent" class="rounded-xl border bg-card p-6 text-center shadow-sm">
      <CheckCircle2 class="mx-auto size-10 text-success" />
      <h3 class="mt-3 text-lg font-semibold">
        {{ sent.review ? 'Submitted for review' : 'Messages queued' }}
      </h3>
      <p class="mt-1 text-sm text-muted-foreground">
        <template v-if="sent.review">
          Your campaign to {{ formatNumber(sent.recipients) }} recipient{{ sent.recipients === 1 ? '' : 's' }}
          is pending approval — you'll be notified once it's reviewed.
        </template>
        <template v-else>
          {{ formatNumber(sent.recipients) }} recipient{{ sent.recipients === 1 ? '' : 's' }} are being processed.
        </template>
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

      <!-- Scheduling (coming soon) -->
      <div class="border-t px-5 py-4">
        <label class="flex items-center justify-between opacity-60">
          <span class="flex items-center gap-2 text-sm font-medium">
            <CalendarClock class="size-4" /> Schedule for later
          </span>
          <Badge variant="muted">Coming soon</Badge>
        </label>
      </div>

      <div class="px-5 pb-5">
        <p v-if="error" class="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{{ error }}</p>
        <Button class="w-full" size="lg" :disabled="!store.canSend.value || sending" @click="send">
          <template v-if="sending">Sending…</template>
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
