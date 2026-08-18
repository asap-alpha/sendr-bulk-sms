<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { KeyRound, Plus, Copy, Check, Trash2, ShieldAlert, Lock, Loader2, BookOpen } from 'lucide-vue-next'
import { useApiKeys, type ApiKey, type ApiKeyMode } from '@/stores/apiKeys'
import { useSenderIds, senderIdsReady } from '@/stores/senderIds'
import { useAuth } from '@/stores/auth'
import { api, ApiError } from '@/lib/api'
import { formatDate, timeAgo } from '@/lib/utils'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Modal from '@/components/ui/Modal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ApiDocs from '@/features/developers/ApiDocs.vue'

const store = useApiKeys()
const senderIds = useSenderIds()
const { user } = useAuth()

const loading = ref(true)
const loadError = ref('')

onMounted(async () => {
  try {
    // Sender IDs decide the first checklist step and fill the code samples, so both reads
    // have to land before the page can say anything true about where you are.
    await Promise.all([store.refresh(), senderIdsReady()])
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : "Couldn't load your API keys."
  } finally {
    loading.value = false
  }
})

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
// A real approved sender ID makes every sample runnable as-is; the placeholder is only
// ever seen by an account that has none, which is also the account the checklist is
// telling to go and get one.
const sampleSender = computed(() => senderIds.approved.value[0]?.name ?? 'YourSenderID')

// ── Access checklist ───────────────────────────────────────────────────────
// The old version numbered three steps and left them all looking untouched, so an account
// that already had an approved sender ID was told to go and do it again. Each step now
// reports its real state, and only one of them is ever "your move".
type StepState = 'done' | 'active' | 'waiting' | 'todo'

const hasApprovedSender = computed(() => senderIds.approved.value.length > 0)
const hasPendingSender = computed(() => senderIds.pending.value.length > 0)

// "We asked" is client-side memory — the server has no request record, and inventing one
// would be a bigger feature than this deserves. Keyed by account so a shared browser
// doesn't show one person's request to another.
const requestedKey = computed(() => `sendr.apiAccessRequested.${user.value?.email ?? 'anon'}`)
const requestedAt = ref<number | null>(null)
onMounted(() => {
  const raw = localStorage.getItem(requestedKey.value)
  requestedAt.value = raw ? Number(raw) || null : null
})

const steps = computed<{ title: string; detail: string; state: StepState }[]>(() => {
  const senderState: StepState = hasApprovedSender.value ? 'done' : hasPendingSender.value ? 'waiting' : 'active'
  const accessState: StepState = store.enabled.value
    ? 'done'
    : !hasApprovedSender.value
      ? 'todo'
      : requestedAt.value
        ? 'waiting'
        : 'active'
  const keyState: StepState = store.items.value.length ? 'done' : store.enabled.value ? 'active' : 'todo'

  return [
    {
      title: 'Get a sender ID approved',
      detail:
        senderState === 'done'
          ? `${sampleSender.value} is approved and ready to send from.`
          : senderState === 'waiting'
            ? 'Your request is with the networks — usually 1–2 business days.'
            : 'The short name recipients see instead of a phone number.',
      state: senderState,
    },
    {
      title: 'Turn on API access',
      detail:
        accessState === 'done'
          ? 'Enabled for this account.'
          : accessState === 'waiting'
            ? `Requested ${timeAgo(requestedAt.value!)} — we'll email you when it's on.`
            : accessState === 'active'
              ? 'One quick check by our team, because API messages send without review.'
              : 'Available once your sender ID is approved.',
      state: accessState,
    },
    {
      title: 'Create your first key',
      detail:
        keyState === 'done'
          ? 'Done — your key is listed below.'
          : keyState === 'active'
            ? 'Then start sending. Test keys cost nothing.'
            : 'The credential your server sends with each request.',
      state: keyState,
    },
  ]
})

// ── Request access ─────────────────────────────────────────────────────────
const requesting = ref(false)
const requestError = ref('')

async function requestAccess() {
  if (requesting.value) return
  requesting.value = true
  requestError.value = ''
  try {
    await api.post('/api/support/send', {
      userName: user.value?.name ?? 'Sendr user',
      userEmail: user.value?.email ?? '',
      category: 'account',
      message:
        `Please enable developer API access for my Sendr account.\n\n` +
        `Approved sender ID: ${sampleSender.value}\n` +
        `Account email: ${user.value?.email ?? '(unknown)'}`,
    })
    requestedAt.value = Date.now()
    localStorage.setItem(requestedKey.value, String(requestedAt.value))
  } catch (e) {
    requestError.value = e instanceof ApiError ? e.message : "Couldn't send the request. Please email support instead."
  } finally {
    requesting.value = false
  }
}

// ── Create ─────────────────────────────────────────────────────────────────
const createOpen = ref(false)
const form = ref<{ name: string; mode: ApiKeyMode; allowedIps: string }>({ name: '', mode: 'live', allowedIps: '' })
const creating = ref(false)
const createError = ref('')

// The plaintext secret, held ONLY while the reveal modal is open. Never written to the
// store, never re-fetchable — closing this modal is the last time it exists anywhere but
// the merchant's own clipboard.
const revealed = ref('')
const revealedName = ref('')

function openCreate() {
  form.value = { name: '', mode: 'live', allowedIps: '' }
  createError.value = ''
  createOpen.value = true
}

async function submitCreate() {
  if (creating.value) return
  createError.value = ''
  creating.value = true
  try {
    const secret = await store.create({
      name: form.value.name,
      mode: form.value.mode,
      // Free text in, list out — a merchant pasting "1.2.3.4, 5.6.7.8" means two addresses.
      allowedIps: form.value.allowedIps.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    })
    revealedName.value = form.value.name.trim() || 'New key'
    revealed.value = secret
    createOpen.value = false
  } catch (e) {
    createError.value = e instanceof ApiError ? e.message : 'Could not create the key. Try again.'
  } finally {
    creating.value = false
  }
}

function dismissReveal() {
  // Drop the secret from memory the moment the merchant is done with it.
  revealed.value = ''
  revealedName.value = ''
}

// ── Copy ───────────────────────────────────────────────────────────────────
const copied = ref('')
async function copy(text: string, tag: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = tag
    setTimeout(() => (copied.value = copied.value === tag ? '' : copied.value), 1800)
  } catch {
    // Clipboard blocked (insecure context / permission). The value is on screen and
    // selectable, so there's nothing to recover from — just don't claim it copied.
  }
}

// ── Revoke ─────────────────────────────────────────────────────────────────
const revokeTarget = ref<ApiKey | null>(null)
const revoking = ref(false)
const revokeError = ref('')

async function confirmRevoke() {
  const k = revokeTarget.value
  if (!k || revoking.value) return
  revoking.value = true
  revokeError.value = ''
  try {
    await store.revoke(k.id)
    revokeTarget.value = null
  } catch (e) {
    revokeError.value = e instanceof ApiError ? e.message : `Couldn't revoke "${k.name}".`
    revokeTarget.value = null
  } finally {
    revoking.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Developers</h1>
        <p class="text-sm text-muted-foreground">
          Send SMS from your own systems, using the same balance and sender IDs.
        </p>
      </div>
      <Button v-if="store.enabled.value && !loading" @click="openCreate">
        <Plus class="size-4" /> Create API key
      </Button>
    </div>

    <p v-if="loadError" class="mt-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ loadError }}
    </p>

    <div v-if="loading" class="mt-6 space-y-3">
      <div v-for="i in 2" :key="i" class="h-24 animate-pulse rounded-xl border bg-muted/40" />
    </div>

    <template v-else>
      <!-- Progress. Shown until there's a key: once you're sending, a checklist of things
           you've already done is just noise above the thing you came for. -->
      <div v-if="!store.items.value.length" class="mt-6 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div class="flex items-start gap-4">
          <div class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Lock v-if="!store.enabled.value" class="size-5 text-primary" />
            <KeyRound v-else class="size-5 text-primary" />
          </div>
          <div>
            <h2 class="text-lg font-semibold">
              {{ store.enabled.value ? 'You’re ready — create your first key' : 'Three steps to sending from your own systems' }}
            </h2>
            <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
              The API lets your website, app or back-office send messages directly — order
              confirmations, delivery alerts, one-time codes. Because those go out unattended,
              we switch it on per account once your sender ID is approved.
            </p>
          </div>
        </div>

        <ol class="mt-6 space-y-4">
          <li v-for="(s, i) in steps" :key="i" class="flex items-start gap-3">
            <!-- The marker carries the state: a tick for done, a spinner for waiting on
                 someone else, a filled number for what's yours to do next. -->
            <span
              class="mt-px flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              :class="{
                'bg-success/15 text-success': s.state === 'done',
                'bg-primary text-primary-foreground': s.state === 'active',
                'bg-warning/20 text-[hsl(38_92%_35%)]': s.state === 'waiting',
                'bg-muted text-muted-foreground': s.state === 'todo',
              }"
            >
              <Check v-if="s.state === 'done'" class="size-3.5" />
              <Loader2 v-else-if="s.state === 'waiting'" class="size-3.5 animate-spin" />
              <template v-else>{{ i + 1 }}</template>
            </span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium" :class="s.state === 'todo' && 'text-muted-foreground'">
                  {{ s.title }}
                </span>
                <Badge v-if="s.state === 'done'" variant="success">Done</Badge>
                <Badge v-else-if="s.state === 'waiting'" variant="warning">Waiting on us</Badge>
                <Badge v-else-if="s.state === 'active'" variant="secondary">Your move</Badge>
              </div>
              <p class="mt-0.5 text-sm text-muted-foreground">{{ s.detail }}</p>

              <!-- The action for whichever step is actually yours -->
              <div v-if="s.state === 'active'" class="mt-2.5">
                <RouterLink v-if="i === 0" :to="{ name: 'senderIds' }">
                  <Button size="sm" variant="outline">Request a sender ID</Button>
                </RouterLink>
                <template v-else-if="i === 1">
                  <Button size="sm" :disabled="requesting" @click="requestAccess">
                    {{ requesting ? 'Sending…' : 'Request API access' }}
                  </Button>
                  <p v-if="requestError" class="mt-1.5 text-xs text-destructive">{{ requestError }}</p>
                </template>
                <Button v-else size="sm" @click="openCreate"><Plus class="size-4" /> Create API key</Button>
              </div>
            </div>
          </li>
        </ol>
      </div>

      <template v-if="store.enabled.value">
        <p v-if="revokeError" class="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {{ revokeError }}
        </p>

        <!-- Keys -->
        <div v-if="store.items.value.length" class="mt-6 space-y-3">
          <h2 class="font-semibold">Your keys</h2>
          <div
            v-for="k in store.items.value"
            :key="k.id"
            class="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm"
            :class="k.status === 'revoked' && 'opacity-60'"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold">{{ k.name }}</span>
                <Badge :variant="k.mode === 'test' ? 'secondary' : 'success'">
                  {{ k.mode === 'test' ? 'Test' : 'Live' }}
                </Badge>
                <Badge v-if="k.status === 'revoked'" variant="destructive">Revoked</Badge>
              </div>
              <code class="mt-1.5 block truncate font-mono text-sm text-muted-foreground">{{ k.prefix }}…</code>
              <div class="mt-1 text-xs text-muted-foreground">
                Created {{ formatDate(k.createdAt) }}
                <template v-if="k.status === 'active'">
                  ·
                  <!-- "Never used" is the signal that a key can be revoked safely, which is
                       the main thing anyone comes to this list to work out. -->
                  {{ k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : 'never used' }}
                </template>
                <template v-else-if="k.revokedAt"> · revoked {{ formatDate(k.revokedAt) }}</template>
              </div>
              <div v-if="k.allowedIps.length" class="mt-1 text-xs text-muted-foreground">
                Restricted to {{ k.allowedIps.join(', ') }}
              </div>
            </div>

            <button
              v-if="k.status === 'active'"
              class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Revoke key"
              @click="revokeTarget = k"
            >
              <Trash2 class="size-4" />
            </button>
          </div>
        </div>
      </template>

      <!-- Reference. Deliberately visible even before access is granted: someone deciding
           whether to ask for it needs to see what they'd be getting, and the samples are
           already filled in with this account's own sender ID. -->
      <div class="mt-10 border-t pt-8">
        <div v-if="!store.enabled.value" class="mb-6 flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <BookOpen class="mt-0.5 size-4 shrink-0 text-primary" />
          <p class="text-muted-foreground">
            Here's what you'll be able to do — have a read while your access is set up.
          </p>
        </div>
        <ApiDocs :base-url="apiBase" :sender-id="sampleSender" />
      </div>
    </template>

    <!-- Create modal -->
    <Modal :open="createOpen" title="Create API key" @close="createOpen = false">
      <form class="space-y-4 p-5" @submit.prevent="submitCreate">
        <div>
          <Label for="key-name">Name</Label>
          <Input id="key-name" v-model="form.name" placeholder="Production server" class="mt-1.5" />
          <p class="mt-1.5 text-xs text-muted-foreground">
            Just for you — so you know which key to revoke later.
          </p>
        </div>

        <div>
          <Label>Type</Label>
          <div class="mt-1.5 grid grid-cols-2 gap-2">
            <button
              v-for="opt in (['live', 'test'] as ApiKeyMode[])"
              :key="opt"
              type="button"
              class="rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
              :class="form.mode === opt ? 'border-primary bg-primary/5' : 'hover:bg-accent'"
              @click="form.mode = opt"
            >
              <span class="font-medium">{{ opt === 'live' ? 'Live' : 'Test' }}</span>
              <span class="mt-0.5 block text-xs text-muted-foreground">
                {{ opt === 'live' ? 'Sends real messages, uses credit' : 'Nothing sent, nothing charged' }}
              </span>
            </button>
          </div>
        </div>

        <div>
          <Label for="key-ips">Allowed IP addresses <span class="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="key-ips" v-model="form.allowedIps" placeholder="41.66.0.1, 41.66.0.2" class="mt-1.5" />
          <p class="mt-1.5 text-xs text-muted-foreground">
            If your sends come from fixed servers, listing them here makes a stolen key useless
            anywhere else. Leave empty to allow any address.
          </p>
        </div>

        <p v-if="createError" class="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ createError }}
        </p>

        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" @click="createOpen = false">Cancel</Button>
          <Button type="submit" :disabled="creating">{{ creating ? 'Creating…' : 'Create key' }}</Button>
        </div>
      </form>
    </Modal>

    <!-- Reveal-once modal. Not dismissible by accident: no backdrop close, one explicit
         button, because after this the secret is gone for good. -->
    <Modal :open="!!revealed" :title="`${revealedName} created`">
      <div class="space-y-4 p-5">
        <div class="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <ShieldAlert class="mt-0.5 size-4 shrink-0 text-[hsl(38_92%_40%)]" />
          <p>
            Copy this now — it won't be shown again. We store only a fingerprint of it, so we
            can't recover it for you. If you lose it, revoke the key and create another.
          </p>
        </div>

        <div class="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <code class="min-w-0 flex-1 break-all font-mono text-xs">{{ revealed }}</code>
          <button
            class="shrink-0 rounded-md border bg-card p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            title="Copy key"
            @click="copy(revealed, 'secret')"
          >
            <Check v-if="copied === 'secret'" class="size-4 text-success" />
            <Copy v-else class="size-4" />
          </button>
        </div>

        <p class="text-xs text-muted-foreground">
          Keep it on your server only — never in a browser, mobile app or code repository.
          Anyone holding it can send messages and spend your credit.
        </p>

        <div class="flex justify-end pt-1">
          <Button @click="dismissReveal">I've saved it</Button>
        </div>
      </div>
    </Modal>

    <ConfirmDialog
      :open="!!revokeTarget"
      title="Revoke this key?"
      :message="`Anything using ${revokeTarget?.name ?? 'this key'} will stop sending within a minute. This can't be undone — you'd need to create a new key and update your systems.`"
      confirm-label="Revoke key"
      loading-label="Revoking…"
      cancel-label="Keep key"
      :loading="revoking"
      @confirm="confirmRevoke"
      @close="revokeTarget = null"
    />
  </div>
</template>
