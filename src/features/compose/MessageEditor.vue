<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { Plus, Ban } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { ComposeKey } from './useCompose'
import { useSenderIds } from '@/stores/senderIds'
import { findEmoji, stripEmoji } from '@/lib/emoji'
import { formatNumber } from '@/lib/utils'
import SegmentMeter from './SegmentMeter.vue'
import Button from '@/components/ui/Button.vue'
import Label from '@/components/ui/Label.vue'

const store = inject(ComposeKey)!
const area = ref<HTMLTextAreaElement | null>(null)

const senderIds = useSenderIds()
const approved = senderIds.approved

// Keep the selected sender ID valid as approvals change (e.g. a new one is granted).
watch(
  approved,
  (list) => {
    if (!list.some((s) => s.name === store.senderId.value)) {
      store.senderId.value = list[0]?.name ?? ''
    }
  },
  { immediate: true },
)

function insertToken(token: string) {
  const el = area.value
  const snippet = `{{${token}}}`
  if (!el) {
    store.message.value += snippet
    return
  }
  const start = el.selectionStart ?? store.message.value.length
  const end = el.selectionEnd ?? start
  const text = store.message.value
  store.message.value = text.slice(0, start) + snippet + text.slice(end)
  nextTick(() => {
    el.focus()
    const pos = start + snippet.length
    el.setSelectionRange(pos, pos)
  })
}

// Emoji policy: not allowed. Surface exactly which ones and offer a one-click fix.
const emojiFound = computed(() => findEmoji(store.message.value))

function removeEmoji() {
  store.message.value = stripEmoji(store.message.value)
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-1.5">
      <Label for="sender">Sender ID</Label>
      <template v-if="approved.length">
        <select
          id="sender"
          v-model="store.senderId.value"
          class="h-9 max-w-xs rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option v-for="s in approved" :key="s.id" :value="s.name">{{ s.name }}</option>
        </select>
        <p class="text-xs text-muted-foreground">
          Only approved sender IDs can be used.
          <RouterLink :to="{ name: 'senderIds' }" class="text-primary hover:underline">Request another</RouterLink>.
        </p>
      </template>
      <div v-else class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground">
        You don't have an approved sender ID yet.
        <RouterLink :to="{ name: 'senderIds' }" class="font-medium text-primary hover:underline">Request one</RouterLink>
        to start sending.
      </div>
    </div>

    <div class="grid gap-1.5">
      <div class="flex items-center justify-between">
        <Label for="message">Message</Label>
      </div>

      <div v-if="store.tokens.value.length" class="flex flex-wrap items-center gap-1.5">
        <span class="text-xs text-muted-foreground">Insert field:</span>
        <button
          v-for="t in store.tokens.value"
          :key="t"
          type="button"
          class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          @click="insertToken(t)"
        >
          <Plus class="size-3" /> {{ t }}
        </button>
      </div>

      <textarea
        id="message"
        ref="area"
        v-model="store.message.value"
        rows="5"
        placeholder="Hi {{name}}, your order {{order_id}} is on the way. Reply STOP to opt out."
        class="flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2"
        :class="emojiFound.length ? 'border-destructive focus-visible:ring-destructive' : 'border-input focus-visible:ring-ring'"
      />
    </div>

    <!-- Emoji not allowed -->
    <div v-if="emojiFound.length" class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
      <Ban class="mt-0.5 size-4 shrink-0 text-destructive" />
      <div class="flex-1">
        <p class="font-medium text-destructive">Emoji aren't allowed in messages</p>
        <p class="mt-0.5 text-muted-foreground">
          Remove {{ emojiFound.slice(0, 8).join(' ') }}{{ emojiFound.length > 8 ? '…' : '' }} to continue.
        </p>
      </div>
      <Button size="sm" variant="outline" class="shrink-0" @click="removeEmoji">Remove emoji</Button>
    </div>

    <SegmentMeter :info="store.meterInfo.value" />

    <div v-if="store.usesMergeData.value" class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
      <p class="font-medium text-[hsl(38_92%_35%)]">Counting the merged message, not the template</p>
      <p class="mt-1 text-muted-foreground">
        The count above is for the <strong>longest row</strong> once your merge fields are filled with real data —
        a long column value pulls in its full text. You typed {{ formatNumber(store.templateInfo.value.length) }}
        characters; the longest merged message is
        <strong>{{ formatNumber(store.worst.value.info.length) }} characters</strong> →
        <strong>{{ store.billedSegments.value }} segments</strong> billed per recipient.
      </p>
    </div>
  </div>
</template>
