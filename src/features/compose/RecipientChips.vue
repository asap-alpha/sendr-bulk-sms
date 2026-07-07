<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { X, Users, AlertTriangle } from 'lucide-vue-next'
import { ComposeKey } from './useCompose'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'

const store = inject(ComposeKey)!
const draft = ref('')

function commit() {
  if (!draft.value.trim()) return
  store.addManual(draft.value)
  draft.value = ''
}

// Enter commits the current line; commas/newlines in a paste are handled by addManual.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Backspace' && !draft.value && store.manual.length) {
    store.removeManual(store.manual.length - 1)
  }
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') ?? ''
  if (/[\n,;]/.test(text)) {
    e.preventDefault()
    store.addManual(text)
  }
}

const validCount = computed(() => store.validRecipients.value.length)
const invalidCount = computed(() => store.invalidCount.value)
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 font-medium text-foreground">
          🇬🇭 Ghana (+233)
        </span>
        <span>Only Ghana numbers are supported</span>
      </div>
      <Button v-if="store.manual.length" variant="ghost" size="sm" @click="store.clearManual()">Clear all</Button>
    </div>

    <div
      class="thin-scroll flex max-h-52 min-h-[7rem] flex-wrap content-start gap-2 overflow-y-auto rounded-lg border border-input bg-background p-3 focus-within:ring-2 focus-within:ring-ring"
      @click="($refs.field as HTMLInputElement)?.focus()"
    >
      <span
        v-for="(r, i) in store.manual"
        :key="i"
        class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
        :class="r.valid ? 'bg-accent text-accent-foreground' : 'bg-destructive/10 text-destructive line-through decoration-destructive/50'"
        :title="r.valid ? r.e164! : 'Invalid number'"
      >
        {{ r.valid ? r.e164 : r.raw }}
        <button class="hover:opacity-70" @click.stop="store.removeManual(i)"><X class="size-3" /></button>
      </span>

      <input
        ref="field"
        v-model="draft"
        class="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        :placeholder="store.manual.length ? 'Add another…' : 'Type a number, press Enter. Or paste a whole list.'"
        @keydown="onKeydown"
        @paste="onPaste"
        @blur="commit"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="success"><Users class="size-3" /> {{ validCount }} valid</Badge>
      <Badge v-if="invalidCount" variant="destructive"><AlertTriangle class="size-3" /> {{ invalidCount }} invalid</Badge>
      <span class="text-muted-foreground">Enter = next number · paste supports commas & new lines</span>
    </div>
  </div>
</template>
