<script setup lang="ts">
import { computed, ref } from 'vue'
import { Zap, Users, UserRoundCheck, Activity, Wallet, AlertTriangle, Gauge } from 'lucide-vue-next'
import CodeBlock from '@/components/ui/CodeBlock.vue'
import {
  LANGUAGES,
  singleSend,
  bulkSend,
  personalisedSend,
  checkStatus,
  balance,
  type LanguageId,
  type SnippetContext,
} from './snippets'

const props = defineProps<{ baseUrl: string; senderId: string }>()

// One language choice for the whole page: a reader who picked PHP once shouldn't have to
// pick it again in every section.
const lang = ref<LanguageId>('curl')

const ctx = computed<SnippetContext>(() => ({ baseUrl: props.baseUrl, senderId: props.senderId }))

const single = computed(() => singleSend(ctx.value)[lang.value])
const bulk = computed(() => bulkSend(ctx.value)[lang.value])
const personalised = computed(() => personalisedSend(ctx.value)[lang.value])
const status = computed(() => checkStatus(ctx.value)[lang.value])
const bal = computed(() => balance(ctx.value)[lang.value])

// Literal examples that contain braces. They CANNOT be inline in the template: Vue's
// tokenizer ends an interpolation at the first "}}", so "{{ '{{token}}' }}" is a parse
// error. Binding them from here is the only way to show the merge syntax at all.
const MERGE_TOKEN = '{{token}}'
const ERROR_SHAPE = '{ success: false, error: { code, message } }'

const errors = [
  { status: '401', code: 'unauthorized', meaning: 'Key missing, wrong, or revoked.' },
  { status: '402', code: 'insufficient_credit', meaning: 'Top up — retrying will not help.' },
  { status: '403', code: 'sender_not_approved', meaning: '`from` is not one of your approved sender IDs.' },
  { status: '403', code: 'kyc_required', meaning: 'Add your Ghana Card number once, in the dashboard.' },
  { status: '403', code: 'account_suspended', meaning: 'Sending is suspended — contact support.' },
  { status: '403', code: 'api_disabled', meaning: 'API access was withdrawn for this account.' },
  { status: '404', code: 'not_found', meaning: 'No message or batch with that id.' },
  { status: '422', code: 'invalid_request', meaning: 'Bad numbers, empty content, unsupported characters.' },
  { status: '429', code: 'rate_limited', meaning: 'Over 120 requests a minute. Batch your recipients.' },
  { status: '503', code: 'service_unavailable', meaning: 'Temporary. Retry with backoff.' },
]
</script>

<template>
  <div class="space-y-10">
    <!-- Language picker, sticky-feeling at the top of the reference -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div>
        <h2 class="text-lg font-semibold">API reference</h2>
        <p class="text-sm text-muted-foreground">
          Base URL <code class="font-mono text-xs">{{ baseUrl }}</code> · authenticate with
          <code class="font-mono text-xs">Authorization: Bearer sk_live_…</code>
        </p>
      </div>
      <div class="inline-flex rounded-lg bg-muted p-1">
        <button
          v-for="l in LANGUAGES"
          :key="l.id"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-all"
          :class="lang === l.id ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'"
          @click="lang = l.id"
        >
          {{ l.label }}
        </button>
      </div>
    </div>

    <!-- Single message — the case most people arrive for -->
    <section>
      <div class="flex items-center gap-2">
        <Zap class="size-4 text-primary" />
        <h3 class="font-semibold">Send one message</h3>
      </div>
      <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
        For one-time codes, order confirmations and alerts. A send of ten recipients or fewer
        goes out <span class="font-medium text-foreground">while your request is open</span>, so
        the response already tells you whether the network accepted it — no second call, nothing
        to poll. That's what makes this usable for login codes.
      </p>
      <CodeBlock class="mt-4" :code="single" />
      <div class="mt-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span class="font-medium text-foreground">clientReference</span> is your own id for the
        send. If your request times out and you retry with the same one, we return the original
        result instead of texting the person twice or charging you twice.
      </div>
    </section>

    <!-- Bulk -->
    <section>
      <div class="flex items-center gap-2">
        <Users class="size-4 text-primary" />
        <h3 class="font-semibold">Send to many</h3>
      </div>
      <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
        Same endpoint — pass a list instead of a single number, up to 10,000 per request. Above
        ten recipients the send is queued and you get a
        <code class="font-mono text-xs">batchId</code> back immediately; duplicate numbers are
        collapsed and billed once.
      </p>
      <CodeBlock class="mt-4" :code="bulk" />
    </section>

    <!-- Personalised -->
    <section>
      <div class="flex items-center gap-2">
        <UserRoundCheck class="size-4 text-primary" />
        <h3 class="font-semibold">Personalise each message</h3>
      </div>
      <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
        Use <code class="font-mono text-xs">recipients</code> with your own fields, and
        <code class="font-mono text-xs">{{ MERGE_TOKEN }}</code> placeholders in the content. A
        recipient missing a field your message uses is skipped and reported back — never sent a
        half-written message.
      </p>
      <CodeBlock class="mt-4" :code="personalised" />
    </section>

    <!-- Status -->
    <section>
      <div class="flex items-center gap-2">
        <Activity class="size-4 text-primary" />
        <h3 class="font-semibold">Check delivery</h3>
      </div>
      <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
        A message goes <code class="font-mono text-xs">queued → sending → sent → delivered</code>,
        or <code class="font-mono text-xs">failed</code>.
        <span class="font-medium text-foreground">sent</span> means the network accepted it;
        <span class="font-medium text-foreground">delivered</span> means it reached the handset,
        which is confirmed over the following minutes. Poll the batch rather than every message.
      </p>
      <CodeBlock class="mt-4" :code="status" />
      <div class="mt-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Messages the network never accepted are refunded automatically, so a finished batch's
        <span class="font-medium text-foreground">cost</span> can be lower than what was first
        held.
      </div>
    </section>

    <!-- Balance -->
    <section>
      <div class="flex items-center gap-2">
        <Wallet class="size-4 text-primary" />
        <h3 class="font-semibold">Check your balance</h3>
      </div>
      <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
        Worth calling on a schedule so a campaign never stops for want of credit. Top-ups happen
        here in the dashboard as usual — there's no separate API balance.
      </p>
      <CodeBlock class="mt-4" :code="bal" />
    </section>

    <!-- Errors -->
    <section>
      <div class="flex items-center gap-2">
        <AlertTriangle class="size-4 text-primary" />
        <h3 class="font-semibold">Errors</h3>
      </div>
      <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
        Every failure returns <code class="font-mono text-xs">{{ ERROR_SHAPE }}</code>.
        Branch on <span class="font-medium text-foreground">code</span>, never on the message —
        we may reword the text. Only
        <code class="font-mono text-xs">rate_limited</code> and
        <code class="font-mono text-xs">service_unavailable</code> are worth retrying blindly.
      </p>
      <div class="mt-4 overflow-x-auto rounded-xl border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th class="px-4 py-2.5 font-medium">HTTP</th>
              <th class="px-4 py-2.5 font-medium">Code</th>
              <th class="px-4 py-2.5 font-medium">What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in errors" :key="e.code" class="border-t">
              <td class="px-4 py-2.5 font-mono text-xs text-muted-foreground">{{ e.status }}</td>
              <td class="px-4 py-2.5 font-mono text-xs">{{ e.code }}</td>
              <td class="px-4 py-2.5 text-muted-foreground">{{ e.meaning }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Limits -->
    <section>
      <div class="flex items-center gap-2">
        <Gauge class="size-4 text-primary" />
        <h3 class="font-semibold">Limits</h3>
      </div>
      <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
        <li><span class="font-medium text-foreground">120 requests a minute</span> per key. A bulk send is one request however many numbers it carries, so batching keeps you well clear.</li>
        <li><span class="font-medium text-foreground">10,000 recipients</span> per request.</li>
        <li><span class="font-medium text-foreground">10 active keys</span> per account — revoke one to free a slot.</li>
        <li>Messages are GSM-7. Emoji and non-Latin scripts are rejected outright rather than silently mangled.</li>
      </ul>
    </section>
  </div>
</template>
