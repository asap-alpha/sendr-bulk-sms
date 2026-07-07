<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ modelValue?: string; class?: string; placeholder?: string; type?: string; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
const classes = computed(() =>
  cn(
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    props.class,
  ),
)
</script>

<template>
  <input
    :type="type ?? 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="classes"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
