<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { KeyRound, Plus, Copy, Check, Trash2, ShieldAlert, TerminalSquare, Info, Lock } from 'lucide-vue-next'
import { useApiKeys, type ApiKey, type ApiKeyMode } from '@/stores/apiKeys'
import { useSenderIds } from '@/stores/senderIds'
import { ApiError } from '@/lib/api'
import { formatDate, timeAgo } from '@/lib/utils'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Modal from '@/components/ui/Modal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const store = useApiKeys()
const senderIds = useSenderIds()

const loading = ref(true)
const loadError = ref('')

onMounted(async () => {
  try {
    await store.refresh()
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : "Couldn't load your API keys."
  } finally {
    loading.value = false
  }
})

// The first approved sender ID, used to make the quickstart snippet copy-paste runnable
// rather than a template the reader has to fill in.
const sampleSender = computed(() => senderIds.approved.value[0]?.name ?? 'YourSenderID')

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

// ── Quickstart ─────────────────────────────────────────────────────────────
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

const curlSnippet = computed(
  () => `curl -X POST ${apiBase}/v1/messages \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": ["0244000000"],
    "from": "${sampleSender.value}",
    "content": "Your order is ready for pickup."
  }'`,
)
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
      <!-- Not granted. A "create" button that we know the server will refuse would be a
           worse experience than saying plainly what the next step is. -->
      <div v-if="!store.enabled.value" class="mt-6 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div class="flex size-11 items-center justify-center rounded-full bg-primary/10">
          <Lock class="size-5 text-primary" />
        </div>
        <h2 class="mt-4 text-lg font-semibold">API access isn't switched on yet</h2>
        <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
          The API lets your own website, app or back-office send messages directly — order
          confirmations, delivery alerts, one-time codes. Because those messages go out
          unattended, we enable it per account after your sender ID is approved.
        </p>
        <ul class="mt-5 space-y-2.5 text-sm text-muted-foreground">
          <li class="flex items-start gap-2.5">
            <span class="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">1</span>
            <span>Get a sender ID approved
              <RouterLink :to="{ name: 'senderIds' }" class="text-primary underline-offset-4 hover:underline">on the Sender IDs page</RouterLink>.
            </span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">2</span>
            <span>Ask support to enable API access for your account.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">3</span>
            <span>Create a key here and start sending.</span>
          </li>
        </ul>
      </div>

      <template v-else>
        <p v-if="revokeError" class="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {{ revokeError }}
        </p>

        <!-- Empty -->
        <div v-if="!store.items.value.length" class="mt-6 rounded-xl border border-dashed bg-card/50 p-10 text-center">
          <div class="mx-auto flex size-11 items-center justify-center rounded-full bg-muted">
            <KeyRound class="size-5 text-muted-foreground" />
          </div>
          <h2 class="mt-4 font-semibold">No API keys yet</h2>
          <p class="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Create one to start sending from your own systems. Test keys let you build the
            integration before it costs anything.
          </p>
          <Button class="mt-5" @click="openCreate"><Plus class="size-4" /> Create API key</Button>
        </div>

        <!-- Keys -->
        <div v-else class="mt-6 space-y-3">
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

        <!-- Quickstart -->
        <div class="mt-10">
          <div class="flex items-center gap-2">
            <TerminalSquare class="size-4 text-primary" />
            <h2 class="font-semibold">Quickstart</h2>
          </div>
          <p class="mt-1.5 text-sm text-muted-foreground">
            One request sends to one number or thousands. Up to 10 recipients come back with the
            result immediately; larger sends return a <code class="font-mono text-xs">batchId</code> to check on.
          </p>
          <div class="relative mt-4">
            <pre class="overflow-x-auto rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed"><code>{{ curlSnippet }}</code></pre>
            <button
              class="absolute right-3 top-3 rounded-md border bg-card p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              title="Copy"
              @click="copy(curlSnippet, 'curl')"
            >
              <Check v-if="copied === 'curl'" class="size-4 text-success" />
              <Copy v-else class="size-4" />
            </button>
          </div>
          <div class="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <Info class="mt-0.5 size-4 shrink-0 text-primary" />
            <p class="text-muted-foreground">
              Check status with <code class="font-mono text-xs">GET /v1/batches/{{ '{id}' }}</code>, and your
              balance with <code class="font-mono text-xs">GET /v1/balance</code>. Credit is topped up here in
              the dashboard as usual — there's no separate API balance.
            </p>
          </div>
        </div>
      </template>
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
