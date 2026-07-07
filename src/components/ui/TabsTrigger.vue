<script setup lang="ts">
import { computed, inject } from 'vue'
import type { Ref } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ value: string; class?: string }>()
const tabs = inject<{ active: Ref<string>; set: (v: string) => void }>('tabs')!

const isActive = computed(() => tabs.active.value === props.value)
const classes = computed(() =>
  cn(
    'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive.value ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
    props.class,
  ),
)
</script>

<template>
  <button type="button" role="tab" :aria-selected="isActive" :class="classes" @click="tabs.set(value)">
    <slot />
  </button>
</template>
