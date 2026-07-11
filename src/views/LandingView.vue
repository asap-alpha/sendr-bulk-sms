<script setup lang="ts">
import {
  MessageSquareText,
  Gauge,
  FileSpreadsheet,
  CalendarClock,
  ShieldCheck,
  BarChart3,
  Wallet,
  ArrowRight,
  Check,
  Sparkles,
} from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { useAuth } from '@/stores/auth'
import { SMS_RATE, CURRENCY } from '@/lib/sms'

const { isAuthenticated } = useAuth()

// Literal merge-field tokens (kept as constants so Vue doesn't parse the braces).
const nameToken = '{{name}}'
const orderToken = '{{order_id}}'

const features = [
  {
    icon: Gauge,
    title: 'Cost transparency',
    body: 'A live segment counter shows chars, encoding, and exact cost as you type — before a stray emoji doubles your bill.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Spreadsheet upload',
    body: 'Drop an Excel or CSV, auto-detect the phone column, and personalize with {{merge}} fields from any column.',
  },
  {
    icon: CalendarClock,
    title: 'Schedule sends',
    body: 'Queue campaigns for the perfect moment. Upload, write, pick a time — done.',
  },
  {
    icon: ShieldCheck,
    title: 'Number hygiene',
    body: 'Numbers are normalized to E.164, de-duplicated, and invalid ones flagged before you pay to send.',
  },
  {
    icon: BarChart3,
    title: 'Delivery reports',
    body: 'Track delivered, failed, and pending across every campaign in one dashboard.',
  },
  {
    icon: Wallet,
    title: 'Prepaid credit',
    body: 'Top up with Mobile Money or card. You only ever spend what you load.',
  },
]

const steps = [
  { n: '1', title: 'Add recipients', body: 'Type numbers or upload a spreadsheet.' },
  { n: '2', title: 'Write your message', body: 'Personalize with merge fields and watch the live cost.' },
  { n: '3', title: 'Send or schedule', body: 'Review the exact spend, then send now or later.' },
]
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Demo banner -->
    <div class="flex items-center justify-center gap-2 bg-primary/10 px-4 py-2 text-center text-xs text-primary sm:text-sm">
      <Sparkles class="size-3.5 shrink-0" />
      <span><span class="font-semibold">Demo environment</span> — explore Sendr Bulk SMS with sample data. Sign up free to try it.</span>
    </div>

    <!-- Nav -->
    <header class="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div class="flex items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquareText class="size-5" />
          </div>
          <span class="text-lg font-semibold tracking-tight">Sendr <span class="font-normal text-muted-foreground">Bulk SMS</span></span>
        </div>
        <nav class="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" class="hover:text-foreground">Features</a>
          <a href="#how" class="hover:text-foreground">How it works</a>
          <a href="#pricing" class="hover:text-foreground">Pricing</a>
        </nav>
        <div class="flex items-center gap-2">
          <template v-if="isAuthenticated">
            <RouterLink :to="{ name: 'compose' }"><Button>Go to app <ArrowRight class="size-4" /></Button></RouterLink>
          </template>
          <template v-else>
            <RouterLink :to="{ name: 'login' }"><Button variant="ghost" size="sm">Sign in</Button></RouterLink>
            <RouterLink :to="{ name: 'signup' }"><Button size="sm">Get started</Button></RouterLink>
          </template>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="pointer-events-none absolute -top-32 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div class="relative mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
        <Badge variant="secondary" class="mx-auto mb-6 gap-1.5">
          <span class="size-1.5 rounded-full bg-success" /> Built for Ghana & beyond
        </Badge>
        <h1 class="mx-auto max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Bulk SMS that respects your budget.
        </h1>
        <p class="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Send to thousands in seconds. See the exact cost before you hit send, personalize from a spreadsheet,
          and track every delivery.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <RouterLink :to="{ name: isAuthenticated ? 'compose' : 'signup' }">
            <Button size="lg">Start sending <ArrowRight class="size-4" /></Button>
          </RouterLink>
          <RouterLink :to="{ name: 'login' }"><Button size="lg" variant="outline">Sign in</Button></RouterLink>
        </div>
        <p class="mt-4 text-sm text-muted-foreground">No credit card. 500 free demo credits.</p>

        <!-- Product peek -->
        <div class="mx-auto mt-16 max-w-4xl rounded-2xl border bg-card p-2 shadow-xl">
          <div class="rounded-xl bg-muted/40 p-6">
            <div class="grid gap-4 text-left sm:grid-cols-[1fr_240px]">
              <div class="space-y-3">
                <div class="rounded-lg border bg-background p-4">
                  <div class="text-xs font-medium text-muted-foreground">Message</div>
                  <div class="mt-1 text-sm">Hi <span class="rounded bg-accent px-1 text-accent-foreground">{{ nameToken }}</span>, your order <span class="rounded bg-accent px-1 text-accent-foreground">{{ orderToken }}</span> is ready 🎉</div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <Badge variant="muted">61 chars</Badge>
                    <Badge variant="warning">2 segments</Badge>
                    <Badge variant="warning">UCS-2</Badge>
                  </div>
                </div>
              </div>
              <div class="rounded-lg border bg-background p-4">
                <div class="text-xs font-medium text-muted-foreground">Review & send</div>
                <div class="mt-2 space-y-1.5 text-sm">
                  <div class="flex justify-between"><span class="text-muted-foreground">Recipients</span><span class="font-medium">1,240</span></div>
                  <div class="flex justify-between"><span class="text-muted-foreground">Total</span><span class="font-semibold">{{ CURRENCY }} 86.80</span></div>
                </div>
                <div class="mt-3 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground">Send now</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="mx-auto max-w-6xl px-4 py-16">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-3xl font-semibold tracking-tight">Everything you need to send with confidence</h2>
        <p class="mt-3 text-muted-foreground">No surprises, no wasted credits.</p>
      </div>
      <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="f in features" :key="f.title" class="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
          <span class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <component :is="f.icon" class="size-5" />
          </span>
          <h3 class="mt-4 font-semibold">{{ f.title }}</h3>
          <p class="mt-1.5 text-sm text-muted-foreground">{{ f.body }}</p>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="border-y bg-muted/30">
      <div class="mx-auto max-w-6xl px-4 py-16">
        <div class="mx-auto max-w-2xl text-center">
          <h2 class="text-3xl font-semibold tracking-tight">Three steps to your first campaign</h2>
        </div>
        <div class="mt-10 grid gap-6 md:grid-cols-3">
          <div v-for="s in steps" :key="s.n" class="relative rounded-xl border bg-card p-6 shadow-sm">
            <span class="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{{ s.n }}</span>
            <h3 class="mt-4 font-semibold">{{ s.title }}</h3>
            <p class="mt-1.5 text-sm text-muted-foreground">{{ s.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="mx-auto max-w-6xl px-4 py-16">
      <div class="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h2 class="text-3xl font-semibold tracking-tight">Simple, prepaid pricing</h2>
        <div class="mt-6 flex items-baseline justify-center gap-1">
          <span class="text-5xl font-semibold">{{ CURRENCY }} {{ SMS_RATE.toFixed(3) }}</span>
          <span class="text-muted-foreground">/ SMS segment</span>
        </div>
        <ul class="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
          <li v-for="p in ['Pay only for what you send', 'No monthly fees or contracts', 'Top up with MoMo or card', 'Volume pricing available']" :key="p" class="flex items-center gap-2">
            <Check class="size-4 text-success" /> {{ p }}
          </li>
        </ul>
        <RouterLink :to="{ name: isAuthenticated ? 'compose' : 'signup' }" class="mt-8 block">
          <Button size="lg" class="w-full">Get started free</Button>
        </RouterLink>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t">
      <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div class="flex items-center gap-2">
          <div class="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <MessageSquareText class="size-3.5" />
          </div>
          <span class="font-medium text-foreground">Sendr <span class="font-normal text-muted-foreground">Bulk SMS</span></span>
        </div>
        <span>© {{ new Date().getFullYear() }} Sendr Bulk SMS.</span>
      </div>
    </footer>
  </div>
</template>
