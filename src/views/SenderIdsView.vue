<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, BadgeCheck, Clock, XCircle, Info, Trash2 } from 'lucide-vue-next'
import { useSenderIds, validateSenderId, type SenderId, type SenderIdStatus } from '@/stores/senderIds'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Modal from '@/components/ui/Modal.vue'

const store = useSenderIds()

onMounted(() => {
  store.refresh().catch(() => {})
})

const statusMeta: Record<SenderIdStatus, { variant: 'success' | 'warning' | 'destructive'; icon: typeof BadgeCheck; label: string }> = {
  approved: { variant: 'success', icon: BadgeCheck, label: 'Approved' },
  pending: { variant: 'warning', icon: Clock, label: 'Pending review' },
  rejected: { variant: 'destructive', icon: XCircle, label: 'Rejected' },
}

// ── Request modal ──────────────────────────────────────────────────────────
const open = ref(false)
const form = ref({ name: '', purpose: '', sample: '' })
const submitError = ref('')
const submitting = ref(false)

const nameError = computed(() => (form.value.name ? validateSenderId(form.value.name) : null))

function openModal() {
  form.value = { name: '', purpose: '', sample: '' }
  submitError.value = ''
  open.value = true
}

// ── Remove confirmation ────────────────────────────────────────────────────
const confirmTarget = ref<SenderId | null>(null)
const removingId = ref<string | null>(null)
const removeError = ref('')

function askRemove(s: SenderId) {
  removeError.value = ''
  confirmTarget.value = s
}

async function confirmRemove() {
  const s = confirmTarget.value
  if (!s || removingId.value) return
  removingId.value = s.id
  removeError.value = ''
  try {
    await store.remove(s.id)
    confirmTarget.value = null
  } catch (e) {
    removeError.value = e instanceof ApiError ? e.message : `Couldn't remove "${s.name}". Please try again.`
    confirmTarget.value = null
  } finally {
    removingId.value = null
  }
}

async function submit() {
  submitError.value = ''
  const err = validateSenderId(form.value.name)
  if (err) {
    submitError.value = err
    return
  }
  if (store.exists(form.value.name)) {
    submitError.value = 'You already have a pending or approved sender ID.'
    return
  }
  if (!form.value.purpose.trim() || !form.value.sample.trim()) {
    submitError.value = 'Describe the purpose and add a sample message.'
    return
  }
  submitting.value = true
  try {
    await store.request(form.value)
    open.value = false
  } catch (e) {
    submitError.value = e instanceof ApiError ? e.message : 'Could not submit the request. Try again.'
  } finally {
    submitting.value = false
  }
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

    <!-- Remove error -->
    <p v-if="removeError" class="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ removeError }}
    </p>

    <!-- List -->
    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <div v-for="s in store.items.value" :key="s.id" class="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-lg font-semibold">{{ s.name }}</div>
            <div class="text-xs text-muted-foreground">Requested {{ formatDate(s.createdAt) }}</div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Badge :variant="statusMeta[s.status].variant">
              <component :is="statusMeta[s.status].icon" class="size-3" />
              {{ statusMeta[s.status].label }}
            </Badge>
            <button
              class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              :disabled="removingId === s.id"
              title="Remove sender ID"
              @click="askRemove(s)"
            >
              <Trash2 class="size-4" />
            </button>
          </div>
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
      </div>

      <!-- Empty state -->
      <div v-if="store.loaded.value && store.items.value.length === 0" class="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground sm:col-span-2">
        No sender ID yet. Request one to start sending campaigns.
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
          <Button type="submit" :disabled="submitting">{{ submitting ? 'Submitting…' : 'Submit for review' }}</Button>
        </div>
      </form>
    </Modal>

    <!-- Remove confirmation -->
    <Modal :open="!!confirmTarget" title="Remove sender ID" @close="confirmTarget = null">
      <div class="px-5 py-4">
        <p class="text-sm text-muted-foreground">
          <template v-if="confirmTarget?.status === 'approved'">
            Remove <strong class="text-foreground">“{{ confirmTarget?.name }}”</strong>? You won't be able to send
            campaigns from it anymore.
          </template>
          <template v-else>
            Remove the <strong class="text-foreground">“{{ confirmTarget?.name }}”</strong> request?
          </template>
        </p>
        <div class="mt-5 flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" @click="confirmTarget = null">Cancel</Button>
          <Button variant="destructive" :disabled="!!removingId" @click="confirmRemove">
            <Trash2 class="size-4" />
            {{ removingId ? 'Removing…' : 'Remove' }}
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
