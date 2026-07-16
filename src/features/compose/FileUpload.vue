<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { UploadCloud, FileSpreadsheet, X, CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import { ComposeKey } from './useCompose'
import { parseSpreadsheet, MAX_RECIPIENTS } from '@/lib/csv'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

const store = inject(ComposeKey)!
const dragging = ref(false)
const error = ref('')
const loading = ref(false)
const input = ref<HTMLInputElement | null>(null)

async function handleFile(file: File | undefined) {
  if (!file) return
  error.value = ''
  loading.value = true
  try {
    const parsed = await parseSpreadsheet(file)
    if (!parsed.rows.length) throw new Error('No data rows found in the file.')
    store.setSheet(parsed)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not read that file.'
  } finally {
    loading.value = false
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handleFile(e.dataTransfer?.files?.[0])
}
function onPick(e: Event) {
  handleFile((e.target as HTMLInputElement).files?.[0])
}

// Only render a sheet this tab loaded — a phone-book import lives in its own tab.
const sheet = computed(() => (store.sheetSource.value === 'upload' ? store.sheet.value : null))
const validCount = computed(() => store.validRecipients.value.length)
const invalidCount = computed(() => store.invalidCount.value)
</script>

<template>
  <div class="space-y-4">
    <!-- Dropzone -->
    <div
      v-if="!sheet"
      class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors"
      :class="dragging ? 'border-primary bg-accent/50' : 'border-input hover:border-primary/50 hover:bg-accent/30'"
      @click="input?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <UploadCloud class="size-8 text-muted-foreground" />
      <div class="text-sm font-medium">Drop your Excel or CSV here, or click to browse</div>
      <div class="text-xs text-muted-foreground">
        .xlsx, .xls, .csv — first row should be column headers. Up to {{ MAX_RECIPIENTS.toLocaleString() }} recipients per file.
      </div>
      <input ref="input" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="onPick" />
    </div>

    <p v-if="error" class="flex items-center gap-1.5 text-sm text-destructive">
      <AlertTriangle class="size-4" /> {{ error }}
    </p>
    <p v-if="loading" class="text-sm text-muted-foreground">Reading file…</p>

    <!-- Loaded file -->
    <template v-if="sheet">
      <div class="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
        <div class="flex items-center gap-2 text-sm">
          <FileSpreadsheet class="size-4 text-primary" />
          <span class="font-medium">{{ sheet.fileName }}</span>
          <Badge variant="secondary">{{ sheet.rows.length }} rows</Badge>
        </div>
        <Button variant="ghost" size="sm" @click="store.clearSheet()"><X class="size-4" /> Remove</Button>
      </div>

      <!-- Column mapping -->
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="space-y-1.5">
          <span class="text-sm font-medium">Which column has the phone numbers?</span>
          <select
            v-model="store.phoneColumn.value"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option v-for="h in sheet.headers" :key="h" :value="h">{{ h }}</option>
          </select>
        </label>
        <div class="space-y-1.5">
          <span class="text-sm font-medium">Country</span>
          <div class="flex h-9 items-center gap-2 rounded-md border bg-muted px-3 text-sm">
            <span class="font-medium">🇬🇭 Ghana (+233)</span>
            <span class="text-xs text-muted-foreground">Non-Ghana numbers are skipped</span>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="success"><CheckCircle2 class="size-3" /> {{ validCount }} valid numbers</Badge>
        <Badge v-if="invalidCount" variant="destructive"><AlertTriangle class="size-3" /> {{ invalidCount }} invalid / skipped</Badge>
        <span class="text-muted-foreground">Other columns are available as merge fields in your message.</span>
      </div>

      <!-- Over the per-campaign recipient limit (after de-duplication) -->
      <p v-if="validCount > MAX_RECIPIENTS" class="flex items-start gap-1.5 text-sm text-destructive">
        <AlertTriangle class="mt-0.5 size-4 shrink-0" />
        <span>
          This file has {{ validCount.toLocaleString() }} unique recipients, over the
          {{ MAX_RECIPIENTS.toLocaleString() }} limit for one campaign. Split it into separate files and send them one at a time.
        </span>
      </p>

      <!-- Data preview -->
      <div class="overflow-hidden rounded-lg border">
        <div class="thin-scroll max-h-56 overflow-auto">
          <table class="w-full text-left text-xs">
            <thead class="sticky top-0 bg-muted">
              <tr>
                <th
                  v-for="h in sheet.headers"
                  :key="h"
                  class="whitespace-nowrap px-3 py-2 font-semibold"
                  :class="h === store.phoneColumn.value ? 'text-primary' : ''"
                >
                  {{ h }}<span v-if="h === store.phoneColumn.value"> 📞</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in sheet.rows.slice(0, 8)" :key="i" class="border-t">
                <td v-for="h in sheet.headers" :key="h" class="whitespace-nowrap px-3 py-1.5">
                  {{ row[h] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
