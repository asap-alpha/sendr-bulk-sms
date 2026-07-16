<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { Keyboard, FileSpreadsheet, Smartphone, Check, ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { ComposeKey } from './useCompose'
import { contactsAvailable, isDesktop } from '@/lib/contacts'
import RecipientChips from './RecipientChips.vue'
import ContactPicker from './ContactPicker.vue'
import FileUpload from './FileUpload.vue'
import MessageEditor from './MessageEditor.vue'
import CostSummary from './CostSummary.vue'
import Tabs from '@/components/ui/Tabs.vue'
import TabsList from '@/components/ui/TabsList.vue'
import TabsTrigger from '@/components/ui/TabsTrigger.vue'
import TabsContent from '@/components/ui/TabsContent.vue'
import Button from '@/components/ui/Button.vue'
import { formatCurrency } from '@/lib/sms'
import { formatNumber } from '@/lib/utils'

const store = inject(ComposeKey)!

// The Contact Picker API only exists on Chrome/Edge for Android, so the tab is
// offered where it works and simply absent everywhere else — file upload covers
// iOS and desktop. Support is queried at runtime, hence the mount hook.
const showContacts = ref(false)
// Desktop users get a one-line pointer to the feature instead, since they may well
// have an Android phone to hand. Mobile users who can't use it are told nothing.
const showPhoneHint = ref(false)
onMounted(async () => {
  showContacts.value = await contactsAvailable()
  showPhoneHint.value = !showContacts.value && isDesktop()
})

const steps = [
  { n: 1 as const, label: 'Recipients' },
  { n: 2 as const, label: 'Message' },
  { n: 3 as const, label: 'Review & send' },
]

// Whether the "Continue" button on the current step is allowed.
const canContinue = computed(() => {
  if (store.step.value === 1) return store.recipientsReady.value
  if (store.step.value === 2) return store.messageReady.value
  return true
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">New campaign</h1>
      <p class="text-sm text-muted-foreground">Add recipients, write your message, and review the cost before you send.</p>
    </div>

    <!-- Stepper chrome — hidden once the campaign is sent -->
    <template v-if="!store.completed.value">
      <nav class="mb-6 flex items-center">
        <template v-for="(s, i) in steps" :key="s.n">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full text-left"
            @click="store.goToStep(s.n)"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors"
              :class="[
                s.n === store.step.value ? 'border-primary bg-primary text-primary-foreground' : '',
                s.n < store.step.value ? 'border-primary bg-primary/10 text-primary' : '',
                s.n > store.step.value ? 'border-input bg-background text-muted-foreground' : '',
              ]"
            >
              <Check v-if="s.n < store.step.value" class="size-4" />
              <template v-else>{{ s.n }}</template>
            </span>
            <span
              class="hidden text-sm font-medium sm:inline"
              :class="s.n === store.step.value ? 'text-foreground' : 'text-muted-foreground'"
            >
              {{ s.label }}
            </span>
          </button>
          <span v-if="i < steps.length - 1" class="mx-2 h-px flex-1 bg-border sm:mx-3" />
        </template>
      </nav>

      <!-- Step 1 · Recipients -->
      <section v-show="store.step.value === 1" class="rounded-xl border bg-card shadow-sm">
        <div class="border-b px-5 py-4">
          <h2 class="font-semibold">Recipients</h2>
          <p class="text-sm text-muted-foreground">
            Type them in{{ showContacts ? ', pick from your phone book' : '' }} or upload a spreadsheet.
          </p>
        </div>
        <div class="px-5 py-4">
          <Tabs v-model="store.source.value">
            <TabsList class="w-full" :class="showContacts ? 'max-w-lg' : 'max-w-sm'">
              <TabsTrigger value="manual"><Keyboard class="size-4" /> Type numbers</TabsTrigger>
              <TabsTrigger v-if="showContacts" value="contacts"><Smartphone class="size-4" /> Phone book</TabsTrigger>
              <TabsTrigger value="upload"><FileSpreadsheet class="size-4" /> Upload file</TabsTrigger>
            </TabsList>
            <TabsContent value="manual"><RecipientChips /></TabsContent>
            <TabsContent v-if="showContacts" value="contacts"><ContactPicker /></TabsContent>
            <TabsContent value="upload"><FileUpload /></TabsContent>
          </Tabs>

          <p v-if="showPhoneHint" class="mt-4 flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
            <Smartphone class="mt-px size-3.5 shrink-0" />
            <span>On an Android phone, you can pick recipients straight from your phone book — open this page in Chrome there.</span>
          </p>
        </div>
      </section>

      <!-- Step 2 · Message -->
      <section v-show="store.step.value === 2" class="rounded-xl border bg-card shadow-sm">
        <div class="border-b px-5 py-4">
          <h2 class="font-semibold">Message</h2>
          <p class="text-sm text-muted-foreground">We count segments and cost live as you type.</p>
        </div>
        <div class="px-5 py-4">
          <MessageEditor />
        </div>
      </section>
    </template>

    <!-- Step 3 · Review & send — single instance, also holds the success screen -->
    <div v-show="store.step.value === 3 || store.completed.value">
      <CostSummary />
    </div>

    <!-- Wizard nav -->
    <div v-if="!store.completed.value" class="mt-6 flex items-center justify-between gap-3">
      <Button v-if="store.step.value > 1" variant="ghost" @click="store.prevStep()">
        <ArrowLeft class="size-4" /> Back
      </Button>
      <span v-else />

      <div class="flex items-center gap-4">
        <span v-if="store.step.value < 3 && store.recipientsReady.value" class="text-xs text-muted-foreground">
          {{ formatNumber(store.validRecipients.value.length) }} recipient{{ store.validRecipients.value.length === 1 ? '' : 's' }}
          <template v-if="store.message.value.trim()"> · {{ formatCurrency(store.totalCost.value) }} est.</template>
        </span>
        <Button v-if="store.step.value < 3" :disabled="!canContinue" @click="store.nextStep()">
          Continue <ArrowRight class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
