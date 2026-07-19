<script setup lang="ts">
/**
 * One-time KYC capture for an account that already holds a sender ID.
 *
 * Banner + modal in one self-contained piece, because it has to appear on more than one
 * screen: Sender IDs is where the merchant can act on it, but Compose is where they
 * actually discover they're blocked — the campaign endpoint refuses them there, and a
 * prompt that only lives on another page reads as a dead end.
 *
 * Renders nothing at all unless KYC is genuinely owed, so it's safe to drop anywhere.
 */
import { computed, ref } from 'vue'
import { ShieldAlert } from 'lucide-vue-next'
import { useSenderIds, validateGhanaCard } from '@/stores/senderIds'
import { ApiError } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Modal from '@/components/ui/Modal.vue'

const store = useSenderIds()

const open = ref(false)
const form = ref({ ghanaCardNumber: '', phone: '' })
const error = ref('')
const submitting = ref(false)

const cardError = computed(() => validateGhanaCard(form.value.ghanaCardNumber))

function openModal() {
  form.value = { ghanaCardNumber: '', phone: '' }
  error.value = ''
  open.value = true
}

async function submit() {
  if (store.needsGhanaCard.value) {
    if (!form.value.ghanaCardNumber.trim()) {
      error.value = 'Your Ghana Card number is required to keep sending.'
      return
    }
    if (cardError.value) {
      error.value = cardError.value
      return
    }
  }
  if (store.needsPhone.value && !form.value.phone.trim()) {
    error.value = 'Add a mobile number so we can reach you about your sender ID.'
    return
  }
  submitting.value = true
  try {
    await store.submitKyc(form.value)
    open.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not save. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="store.needsKycBackfill.value">
    <div
      class="flex flex-wrap items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <ShieldAlert class="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
      <div class="min-w-48 flex-1">
        <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">One-time verification needed</p>
        <p class="text-sm text-amber-800 dark:text-amber-300">
          Networks require a verified identity behind your sender name. Sending is paused until you add it.
        </p>
      </div>
      <Button variant="outline" @click="openModal">Add details</Button>
    </div>

    <Modal :open="open" title="Verify your identity" @close="open = false">
      <form class="space-y-4 px-5 py-4" @submit.prevent="submit">
        <p class="text-sm text-muted-foreground">
          Networks require a verified identity behind a sender name. This is a one-time
          check and your sending resumes as soon as it's saved.
        </p>

        <div v-if="store.needsGhanaCard.value" class="grid gap-1.5">
          <Label for="kyc-ghana-card">Ghana Card number</Label>
          <Input
            id="kyc-ghana-card"
            v-model="form.ghanaCardNumber"
            placeholder="GHA-123456789-0"
            autocomplete="off"
            class="max-w-xs"
          />
          <span :class="cardError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'">
            {{ cardError ?? 'As printed on your Ghana Card.' }}
          </span>
        </div>

        <div v-if="store.needsPhone.value" class="grid gap-1.5">
          <Label for="kyc-phone">Mobile number</Label>
          <Input
            id="kyc-phone"
            v-model="form.phone"
            placeholder="0245045867"
            autocomplete="tel"
            inputmode="tel"
            class="max-w-xs"
          />
          <span class="text-xs text-muted-foreground">
            We'll use this to reach you about your sender ID.
          </span>
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <div class="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" @click="open = false">Cancel</Button>
          <Button type="submit" :disabled="submitting">{{ submitting ? 'Saving…' : 'Save' }}</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
