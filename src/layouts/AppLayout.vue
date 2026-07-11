<script setup lang="ts">
import { onMounted, provide } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { ComposeKey, createCompose } from '@/features/compose/useCompose'
import { useWallet } from '@/stores/wallet'
import { useSenderIds } from '@/stores/senderIds'
import { usePricing } from '@/stores/pricing'

// Compose state lives at the layout so it survives navigation between screens.
const store = createCompose()
provide(ComposeKey, store)

// Load the wallet balance (header), sender-ID list (compose picker), and live pricing
// once the user enters the authenticated area.
const wallet = useWallet()
const senderIds = useSenderIds()
const pricing = usePricing()
onMounted(() => {
  wallet.refresh().catch(() => {})
  senderIds.refresh().catch(() => {})
  pricing.refresh().catch(() => {})
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppHeader />
    <main>
      <RouterView />
    </main>
  </div>
</template>
