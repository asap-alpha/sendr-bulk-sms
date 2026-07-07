<script setup lang="ts">
import { provide, ref, toRef, watch } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const active = ref(props.modelValue)
watch(toRef(props, 'modelValue'), (v) => (active.value = v))

function set(value: string) {
  active.value = value
  emit('update:modelValue', value)
}

provide('tabs', { active, set })
</script>

<template>
  <div><slot /></div>
</template>
