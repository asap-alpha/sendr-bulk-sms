<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'

defineProps<{ code: string; label?: string }>()

const copied = ref(false)
async function copy(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    // Clipboard blocked (insecure context or denied permission). The code is on screen
    // and selectable, so nothing is lost — just don't claim it copied.
  }
}
</script>

<template>
  <div class="relative">
    <div v-if="label" class="mb-1.5 text-xs font-medium text-muted-foreground">{{ label }}</div>
    <pre
      class="overflow-x-auto rounded-xl border bg-muted/40 p-4 pr-12 text-xs leading-relaxed"
    ><code>{{ code }}</code></pre>
    <button
      class="absolute right-3 rounded-md border bg-card p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      :class="label ? 'top-9' : 'top-3'"
      :title="copied ? 'Copied' : 'Copy'"
      @click="copy(code)"
    >
      <Check v-if="copied" class="size-4 text-success" />
      <Copy v-else class="size-4" />
    </button>
  </div>
</template>
