<script setup lang="ts">
import { computed, inject } from 'vue'
import type { Ref } from 'vue'

const props = defineProps<{ value: string }>()
const tabs = inject<{ active: Ref<string>; set: (v: string) => void }>('tabs')!
const show = computed(() => tabs.active.value === props.value)
</script>

<template>
  <div v-show="show" role="tabpanel" class="mt-4 focus-visible:outline-none">
    <slot />
  </div>
</template>
