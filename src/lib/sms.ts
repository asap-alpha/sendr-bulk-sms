/**
 * SMS encoding + segmentation math.
 *
 * Carriers bill per *segment*, not per message. The rules:
 *  - If every character is in the GSM 03.38 alphabet, the message uses GSM-7
 *    encoding: 160 chars for a single segment, 153 per segment once it splits
 *    (7 chars are stolen for the multipart header — UDH).
 *  - The moment a single character falls outside GSM-7 (emoji, curly quotes,
 *    many accented letters, non-Latin scripts), the WHOLE message switches to
 *    UCS-2: 70 chars single, 67 per segment when multipart.
 *  - A handful of GSM characters ( ^ { } \ [ ~ ] | € ) live in an "extension"
 *    table and cost 2 characters each.
 *
 * This is the single source of truth the UI uses to warn people before a
 * stray emoji quietly doubles their bill.
 */

// GSM 03.38 basic character set.  marks the ESC slot (extension prefix).
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'

// Characters that require the extension table — each counts as 2 GSM chars.
const GSM_EXTENSION = '\f^{}\\[~]|€'

const GSM_BASIC_SET = new Set(GSM_BASIC.split(''))
const GSM_EXTENSION_SET = new Set(GSM_EXTENSION.split(''))

export type SmsEncoding = 'GSM-7' | 'UCS-2'

export interface SegmentInfo {
  encoding: SmsEncoding
  /** Weighted character count (extension chars count as 2 under GSM-7). */
  length: number
  /** Number of segments this message will be billed as. */
  segments: number
  /** Characters allowed per segment for the current encoding/segment count. */
  perSegment: number
  /** Characters remaining before the next segment starts. */
  remaining: number
  /** True if any character forced UCS-2 (worth flagging to the user). */
  hasUnicode: boolean
}

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM_BASIC_SET.has(ch) && !GSM_EXTENSION_SET.has(ch)) return false
  }
  return true
}

/** Weighted length for GSM-7 (extension chars are 2). */
function gsm7Length(text: string): number {
  let len = 0
  for (const ch of text) len += GSM_EXTENSION_SET.has(ch) ? 2 : 1
  return len
}

export function analyzeMessage(text: string): SegmentInfo {
  const gsm = isGsm7(text)
  const encoding: SmsEncoding = gsm ? 'GSM-7' : 'UCS-2'

  // UCS-2 counts by UTF-16 code units, but we count code points and treat
  // astral chars (most emoji) as 2 units, which is how carriers bill them.
  const length = gsm
    ? gsm7Length(text)
    : [...text].reduce((n, ch) => n + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0)

  const singleMax = gsm ? 160 : 70
  const multiMax = gsm ? 153 : 67

  let segments: number
  let perSegment: number
  if (length === 0) {
    segments = 0
    perSegment = singleMax
  } else if (length <= singleMax) {
    segments = 1
    perSegment = singleMax
  } else {
    segments = Math.ceil(length / multiMax)
    perSegment = multiMax
  }

  const capacity = segments <= 1 ? singleMax : segments * multiMax
  const remaining = Math.max(0, capacity - length)

  return {
    encoding,
    length,
    segments,
    perSegment,
    remaining,
    hasUnicode: !gsm,
  }
}

// ── Pricing ────────────────────────────────────────────────────────────────
// Kept here so it's trivial to swap for a real rate card from the backend.
export const SMS_RATE = 0.035 // credits (≈ GHS) per segment
export const CURRENCY = 'GHS'

export function formatCurrency(amount: number): string {
  return `${CURRENCY} ${amount.toFixed(2)}`
}

/** Cost of one message to one recipient. */
export function costPerRecipient(segments: number): number {
  return segments * SMS_RATE
}

/** Total campaign cost. */
export function campaignCost(recipients: number, segments: number): number {
  return recipients * costPerRecipient(segments)
}
