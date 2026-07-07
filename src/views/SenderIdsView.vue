<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, BadgeCheck, Clock, XCircle, Info, ShieldQuestion } from 'lucide-vue-next'
import { useSenderIds, validateSenderId, type SenderIdStatus } from '@/stores/senderIds'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Modal from '@/components/ui/Modal.vue'

const store = useSenderIds()

const statusMeta: Record<SenderIdStatus, { variant: 'success' | 'warning' | 'destructive'; icon: typeof BadgeCheck; label: string }> = {
  approved: { variant: 'success', icon: BadgeCheck, label: 'Approved' },
  pending: { variant: 'warning', icon: Clock, label: 'Pending review' },
  rejected: { variant: 'destructive', icon: XCircle, label: 'Rejected' },
}

// ── Request modal ──────────────────────────────────────────────────────────
const open = ref(false)
const form = ref({ name: '', purpose: '', sample: '' })
const submitError = ref('')

const nameError = computed(() => (form.value.name ? validateSenderId(form.value.name) : null))

function openModal() {
  form.value = { name: '', purpose: '', sample: '' }
  submitError.value = ''
  open.value = true
}

function submit() {
  submitError.value = ''
  const err = validateSenderId(form.value.name)
  if (err) {
    submitError.value = err
    return
  }
  if (store.exists(form.value.name)) {
    submitError.value = 'You already have a request or approval for that sender ID.'
    return
  }
  if (!form.value.purpose.trim() || !form.value.sample.trim()) {
    submitError.value = 'Describe the purpose and add a sample message.'
    return
  }
  store.request(form.value)
  open.value = false
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Sender IDs</h1>
        <p class="text-sm text-muted-foreground">The name recipients see. Each one is reviewed before you can send with it.</p>
      </div>
      <Button @click="openModal"><Plus class="size-4" /> Request sender ID</Button>
    </div>

    <!-- Info banner -->
    <div class="mt-6 flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
      <Info class="mt-0.5 size-4 shrink-0 text-primary" />
      <p class="text-muted-foreground">
        Approval typically takes 1–2 business days. Use 3–11 letters/numbers, no spaces. Marketing IDs may require
        business registration.
      </p>
    </div>

    <!-- List -->
    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <div v-for="s in store.items.value" :key="s.id" class="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-lg font-semibold">{{ s.name }}</div>
            <div class="text-xs text-muted-foreground">Requested {{ formatDate(s.createdAt) }}</div>
          </div>
          <Badge :variant="statusMeta[s.status].variant" class="shrink-0">
            <component :is="statusMeta[s.status].icon" class="size-3" />
            {{ statusMeta[s.status].label }}
          </Badge>
        </div>

        <dl class="mt-3 space-y-2 text-sm">
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Purpose</dt>
            <dd>{{ s.purpose }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Sample message</dt>
            <dd class="text-muted-foreground">"{{ s.sample }}"</dd>
          </div>
        </dl>

        <div v-if="s.status === 'rejected' && s.rejectionReason" class="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {{ s.rejectionReason }}
        </div>

        <!-- Demo reviewer controls -->
        <div v-if="s.status === 'pending'" class="mt-4 flex items-center gap-2 border-t pt-3">
          <span class="flex items-center gap-1 text-xs text-muted-foreground"><ShieldQuestion class="size-3.5" /> Demo review:</span>
          <Button size="sm" variant="outline" @click="store.approve(s.id)">Approve</Button>
          <Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" @click="store.reject(s.id, 'Insufficient information provided for this sender ID.')">
            Reject
          </Button>
        </div>
      </div>
    </div>

    <!-- Request modal -->
    <Modal :open="open" title="Request a sender ID" @close="open = false">
      <form class="space-y-4 px-5 py-4" @submit.prevent="submit">
        <div class="grid gap-1.5">
          <Label for="sid-name">Sender ID</Label>
          <Input id="sid-name" v-model="form.name" placeholder="e.g. MyBrand" class="max-w-xs" />
          <div class="flex items-center justify-between text-xs">
            <span :class="nameError ? 'text-destructive' : 'text-muted-foreground'">
              {{ nameError ?? 'Letters and numbers, up to 11 characters.' }}
            </span>
            <span class="tabular-nums text-muted-foreground">{{ form.name.length }}/11</span>
          </div>
        </div>

        <div class="grid gap-1.5">
          <Label for="sid-purpose">What will you use it for?</Label>
          <Input id="sid-purpose" v-model="form.purpose" placeholder="e.g. Order updates for my store" />
        </div>

        <div class="grid gap-1.5">
          <Label for="sid-sample">Sample message</Label>
          <Textarea id="sid-sample" v-model="form.sample" :rows="3" placeholder="An example of a message you'll send from this sender ID." />
        </div>

        <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>

        <div class="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" @click="open = false">Cancel</Button>
          <Button type="submit">Submit for review</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
