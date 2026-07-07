<script setup lang="ts">
import { inject } from 'vue'
import { Keyboard, FileSpreadsheet } from 'lucide-vue-next'
import { ComposeKey } from './useCompose'
import RecipientChips from './RecipientChips.vue'
import FileUpload from './FileUpload.vue'
import MessageEditor from './MessageEditor.vue'
import CostSummary from './CostSummary.vue'
import Tabs from '@/components/ui/Tabs.vue'
import TabsList from '@/components/ui/TabsList.vue'
import TabsTrigger from '@/components/ui/TabsTrigger.vue'
import TabsContent from '@/components/ui/TabsContent.vue'

const store = inject(ComposeKey)!
</script>

<template>
  <div class="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
    <!-- Main column -->
    <div class="min-w-0 space-y-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p class="text-sm text-muted-foreground">Add recipients, write your message, and see the cost before you send.</p>
      </div>

      <!-- Recipients -->
      <section class="rounded-xl border bg-card shadow-sm">
        <div class="border-b px-5 py-4">
          <h2 class="font-semibold">1 · Recipients</h2>
          <p class="text-sm text-muted-foreground">Type them in or upload a spreadsheet.</p>
        </div>
        <div class="px-5 py-4">
          <Tabs v-model="store.source.value">
            <TabsList class="w-full max-w-sm">
              <TabsTrigger value="manual"><Keyboard class="size-4" /> Type numbers</TabsTrigger>
              <TabsTrigger value="upload"><FileSpreadsheet class="size-4" /> Upload file</TabsTrigger>
            </TabsList>
            <TabsContent value="manual"><RecipientChips /></TabsContent>
            <TabsContent value="upload"><FileUpload /></TabsContent>
          </Tabs>
        </div>
      </section>

      <!-- Message -->
      <section class="rounded-xl border bg-card shadow-sm">
        <div class="border-b px-5 py-4">
          <h2 class="font-semibold">2 · Message</h2>
          <p class="text-sm text-muted-foreground">We count segments and cost live as you type.</p>
        </div>
        <div class="px-5 py-4">
          <MessageEditor />
        </div>
      </section>
    </div>

    <!-- Sidebar -->
    <aside>
      <CostSummary />
    </aside>
  </div>
</template>
