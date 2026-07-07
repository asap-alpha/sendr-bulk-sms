<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />
        <div class="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border bg-card shadow-xl">
          <div v-if="title" class="flex items-center justify-between border-b px-5 py-4">
            <h3 class="font-semibold">{{ title }}</h3>
            <button class="text-muted-foreground transition-colors hover:text-foreground" @click="emit('close')">
              <X class="size-5" />
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
