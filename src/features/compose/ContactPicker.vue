<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Smartphone, X, CheckCircle2, AlertTriangle, Users } from 'lucide-vue-next'
import { ComposeKey } from './useCompose'
import { pickContacts, NAME_COLUMN, PHONE_COLUMN } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

const store = inject(ComposeKey)!
const error = ref('')
const loading = ref(false)
const withoutNumber = ref(0)

// Only render an import this tab produced — an uploaded file lives in its own tab.
const sheet = computed(() => (store.sheetSource.value === 'contacts' ? store.sheet.value : null))

/**
 * Fold a fresh pick into what's already imported. The native picker only ever returns
 * one session's worth of taps, so "Add more" has to merge — replacing would silently
 * drop everyone chosen earlier. Later duplicates lose to the number already in the list.
 */
function mergeRows(existing: Record<string, string>[], incoming: Record<string, string>[]) {
  const seen = new Set<string>()
  const rows: Record<string, string>[] = []
  for (const row of [...existing, ...incoming]) {
    const key = normalizePhone(row[PHONE_COLUMN] ?? '').e164 ?? row[PHONE_COLUMN] ?? ''
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    rows.push(row)
  }
  return rows
}

async function choose() {
  error.value = ''
  loading.value = true
  try {
    const result = await pickContacts()
    if (!result) return // user dismissed the picker
    if (!result.sheet.rows.length) {
      error.value = 'None of those contacts had a phone number saved.'
      return
    }

    const current = sheet.value
    const rows = current ? mergeRows(current.rows, result.sheet.rows) : result.sheet.rows
    // Union the headers: one named contact anywhere makes {{Name}} worth offering, and
    // every row needs the key present or the merge field renders as a literal token.
    const headers = [...new Set([...(current?.headers ?? []), ...result.sheet.headers])]
    if (headers.includes(NAME_COLUMN)) {
      for (const row of rows) row[NAME_COLUMN] ??= ''
    }

    withoutNumber.value = (current ? withoutNumber.value : 0) + result.withoutNumber
    store.setSheet({ ...result.sheet, headers, rows }, 'contacts')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not open your phone book.'
  } finally {
    loading.value = false
  }
}

function clear() {
  withoutNumber.value = 0
  store.clearSheet()
}

const hasNames = computed(() => sheet.value?.headers.includes(NAME_COLUMN) ?? false)
// Written out rather than inlined so Vue doesn't interpolate the braces.
const nameToken = `{{${NAME_COLUMN}}}`

const preview = computed(() =>
  (sheet.value?.rows ?? []).slice(0, 8).map((row) => ({
    name: row[NAME_COLUMN] ?? '',
    ...normalizePhone(row[PHONE_COLUMN] ?? ''),
  })),
)
const more = computed(() => Math.max(0, (sheet.value?.rows.length ?? 0) - preview.value.length))
const validCount = computed(() => store.validRecipients.value.length)
const invalidCount = computed(() => store.invalidCount.value)
</script>

<template>
  <div class="space-y-4">
    <!-- Empty state -->
    <div
      v-if="!sheet"
      class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input p-8 text-center"
    >
      <Smartphone class="size-8 text-muted-foreground" />
      <div class="space-y-1">
        <div class="text-sm font-medium">Pick people straight from your phone book</div>
        <p class="text-xs text-muted-foreground">
          Your phone shows its own contact list — we only receive the people you tap, and nothing is
          saved to your device's permissions.
        </p>
      </div>
      <Button :disabled="loading" @click="choose">
        <Users class="size-4" /> {{ loading ? 'Opening…' : 'Choose contacts' }}
      </Button>
    </div>

    <p v-if="error" class="flex items-start gap-1.5 text-sm text-destructive">
      <AlertTriangle class="mt-0.5 size-4 shrink-0" /> {{ error }}
    </p>

    <!-- Imported contacts -->
    <template v-if="sheet">
      <div class="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
        <div class="flex items-center gap-2 text-sm">
          <Smartphone class="size-4 text-primary" />
          <span class="font-medium">From your phone book</span>
          <Badge variant="secondary">{{ sheet.rows.length }} contacts</Badge>
        </div>
        <div class="flex items-center gap-1">
          <Button variant="ghost" size="sm" :disabled="loading" @click="choose">Add more</Button>
          <Button variant="ghost" size="sm" @click="clear"><X class="size-4" /> Remove</Button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="success"><CheckCircle2 class="size-3" /> {{ validCount }} valid numbers</Badge>
        <Badge v-if="invalidCount" variant="destructive">
          <AlertTriangle class="size-3" /> {{ invalidCount }} invalid / skipped
        </Badge>
        <Badge v-if="withoutNumber" variant="secondary">{{ withoutNumber }} had no number</Badge>
        <span v-if="hasNames" class="text-muted-foreground">
          Use <code class="rounded bg-muted px-1 font-mono">{{ nameToken }}</code> in your message to
          greet each person by name.
        </span>
      </div>

      <!-- Contact preview -->
      <div class="overflow-hidden rounded-lg border">
        <ul class="thin-scroll max-h-56 divide-y overflow-auto text-sm">
          <li v-for="(c, i) in preview" :key="i" class="flex items-center justify-between gap-3 px-3 py-2">
            <span class="truncate">
              <span v-if="c.name" class="font-medium">{{ c.name }}</span>
              <span v-else class="text-muted-foreground">No name</span>
            </span>
            <span
              class="shrink-0 font-mono text-xs"
              :class="c.valid ? 'text-muted-foreground' : 'text-destructive line-through decoration-destructive/50'"
              :title="c.valid ? undefined : c.reason"
            >
              {{ c.valid ? c.e164 : c.raw }}
            </span>
          </li>
        </ul>
        <div v-if="more" class="border-t bg-muted/40 px-3 py-1.5 text-center text-xs text-muted-foreground">
          + {{ more }} more
        </div>
      </div>

      <p class="text-xs text-muted-foreground">
        Contacts with more than one number are messaged once, on their first Ghana mobile number.
      </p>
    </template>
  </div>
</template>
