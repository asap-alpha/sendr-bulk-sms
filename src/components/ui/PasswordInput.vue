<script setup lang="ts">
import { ref, computed } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<{ modelValue?: string; class?: string; placeholder?: string; id?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const show = ref(false)
const classes = computed(() =>
  cn(
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-10 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    props.class,
  ),
)
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      :type="show ? 'text' : 'password'"
      :value="modelValue"
      :placeholder="placeholder"
      :class="classes"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      tabindex="-1"
      :aria-label="show ? 'Hide password' : 'Show password'"
      class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @click="show = !show"
    >
      <EyeOff v-if="show" class="size-4" />
      <Eye v-else class="size-4" />
    </button>
  </div>
</template>
