<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string }>()
const classes = computed(() =>
  cn('inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', props.class),
)
</script>

<template>
  <div role="tablist" :class="classes"><slot /></div>
</template>
