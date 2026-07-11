<script setup lang="ts">
import Modal from './Modal.vue'
import Button from './Button.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** Body text. Omit and use the default slot for richer content. */
    message?: string
    confirmLabel?: string
    /** Shown on the confirm button while `loading`. */
    loadingLabel?: string
    /** Dismiss button label — phrase it as the safe choice (e.g. "Keep campaign"). */
    cancelLabel?: string
    variant?: 'default' | 'destructive'
    loading?: boolean
  }>(),
  {
    confirmLabel: 'Confirm',
    loadingLabel: 'Working…',
    cancelLabel: 'Cancel',
    variant: 'destructive',
    loading: false,
  },
)
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'close'): void }>()
</script>

<template>
  <Modal :open="open" :title="title" @close="emit('close')">
    <div class="px-5 py-4">
      <div class="text-sm text-muted-foreground">
        <slot>{{ message }}</slot>
      </div>
      <div class="mt-5 flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" :disabled="loading" @click="emit('close')">{{ cancelLabel }}</Button>
        <Button :variant="variant" :disabled="loading" @click="emit('confirm')">
          {{ loading ? loadingLabel : confirmLabel }}
        </Button>
      </div>
    </div>
  </Modal>
</template>
