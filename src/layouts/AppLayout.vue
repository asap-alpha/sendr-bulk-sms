<script setup lang="ts">
import { provide } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { ComposeKey, createCompose } from '@/features/compose/useCompose'

// Compose state lives at the layout so it survives navigation between screens.
const store = createCompose()
provide(ComposeKey, store)
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppHeader />
    <main>
      <RouterView />
    </main>
  </div>
</template>
