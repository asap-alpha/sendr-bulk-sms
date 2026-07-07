<script setup lang="ts">
import { computed } from 'vue'
import type { SegmentInfo } from '@/lib/sms'
import { formatNumber } from '@/lib/utils'
import Badge from '@/components/ui/Badge.vue'

const props = defineProps<{ info: SegmentInfo }>()

// Progress toward the next segment boundary (fills, then resets each segment).
const pct = computed(() => {
  const { length, perSegment, segments } = props.info
  if (length === 0) return 0
  const used = length - (segments - 1) * perSegment
  return Math.min(100, (used / perSegment) * 100)
})

const barColor = computed(() => {
  if (props.info.segments >= 4) return 'bg-destructive'
  if (props.info.segments >= 2) return 'bg-warning'
  return 'bg-primary'
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="muted">{{ formatNumber(info.length) }} chars</Badge>
      <Badge :variant="info.segments >= 2 ? 'warning' : 'secondary'">
        {{ formatNumber(info.segments) }} {{ info.segments === 1 ? 'segment' : 'segments' }}
      </Badge>
      <Badge :variant="info.hasUnicode ? 'warning' : 'success'">{{ info.encoding }}</Badge>
      <span class="text-muted-foreground">{{ info.remaining }} left in segment</span>
    </div>

    <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div class="h-full rounded-full transition-all duration-200" :class="barColor" :style="{ width: pct + '%' }" />
    </div>

    <p v-if="info.hasUnicode" class="flex items-start gap-1.5 text-xs text-[hsl(38_92%_38%)]">
      <span>⚠️</span>
      <span>
        A special character (emoji, curly quote, or accent) switched this to Unicode.
        Each segment now holds only {{ info.perSegment }} characters instead of 160.
      </span>
    </p>
  </div>
</template>
