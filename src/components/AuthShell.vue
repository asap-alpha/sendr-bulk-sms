<script setup lang="ts">
import { MessageSquareText, Check } from 'lucide-vue-next'

const points = [
  'See the exact cost before every send',
  'Upload a spreadsheet and personalize with merge fields',
  'Schedule campaigns and track delivery',
]
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <!-- Brand panel -->
    <div class="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
      <div class="flex items-center gap-2">
        <div class="flex size-9 items-center justify-center rounded-lg bg-white/15">
          <MessageSquareText class="size-5" />
        </div>
        <span class="text-xl font-semibold">Sendr <span class="font-normal text-primary-foreground/70">Bulk SMS</span></span>
      </div>
      <div class="space-y-6">
        <h1 class="text-3xl font-semibold leading-tight">
          Bulk SMS that respects your budget.
        </h1>
        <ul class="space-y-3">
          <li v-for="p in points" :key="p" class="flex items-start gap-3 text-primary-foreground/90">
            <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Check class="size-3" />
            </span>
            <span>{{ p }}</span>
          </li>
        </ul>
      </div>
      <p class="text-sm text-primary-foreground/70">© {{ new Date().getFullYear() }} Sendr Bulk SMS. Demo environment.</p>
      <div class="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-16 right-10 size-52 rounded-full bg-white/10 blur-2xl" />
    </div>

    <!-- Form panel -->
    <div class="flex items-center justify-center bg-background p-6">
      <div class="w-full max-w-sm">
        <div class="mb-8 flex items-center gap-2 lg:hidden">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquareText class="size-5" />
          </div>
          <span class="text-lg font-semibold">Sendr <span class="font-normal text-muted-foreground">Bulk SMS</span></span>
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>
