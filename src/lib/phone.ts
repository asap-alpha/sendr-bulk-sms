/**
 * Phone-number normalization to E.164 — Ghana only.
 *
 * The platform currently only processes Ghana (+233) numbers, so this
 * normalizer assumes Ghana for local numbers and rejects anything that clearly
 * belongs to another country. When we onboard more markets, reintroduce a
 * country list and pass the sender's default country here (or swap for
 * libphonenumber-js at the backend seam).
 */

export interface Country {
  code: string // ISO 3166-1 alpha-2
  name: string
  dial: string // dialing code without +
  /** Expected national number length(s), excluding the dial code. */
  nsnLengths: number[]
}

// Ghana is the only supported market for now.
export const GHANA: Country = { code: 'GH', name: 'Ghana', dial: '233', nsnLengths: [9] }
export const COUNTRIES: Country[] = [GHANA]

export const DEFAULT_COUNTRY = 'GH'

export function getCountry(_code: string = DEFAULT_COUNTRY): Country {
  return GHANA
}

export interface NormalizedPhone {
  raw: string
  e164: string | null
  valid: boolean
  reason?: string
}

/**
 * Normalize a single raw string to a Ghana E.164 number (+233XXXXXXXXX).
 * Non-Ghana international numbers are rejected as invalid.
 */
export function normalizePhone(raw: string, _defaultCountry = DEFAULT_COUNTRY): NormalizedPhone {
  const trimmed = raw.trim()
  if (!trimmed) return { raw, e164: null, valid: false, reason: 'empty' }

  // Strip everything except digits; note whether it was written in intl form.
  const hasIntl = trimmed.startsWith('+') || trimmed.startsWith('00')
  let digits = trimmed.replace(/[^\d]/g, '')
  if (trimmed.startsWith('00')) digits = digits.replace(/^00/, '')

  if (!digits) return { raw, e164: null, valid: false, reason: 'no digits' }

  let national: string

  if (hasIntl) {
    // Explicit country code — only Ghana is accepted.
    if (digits.startsWith(GHANA.dial)) {
      national = digits.slice(GHANA.dial.length)
    } else {
      return { raw, e164: null, valid: false, reason: 'not Ghana' }
    }
  } else if (digits.startsWith(GHANA.dial)) {
    // Carries 233 without a +.
    national = digits.slice(GHANA.dial.length)
  } else if (digits.startsWith('0')) {
    // Local trunk-prefixed number, e.g. 024 123 4567 → drop the leading 0.
    national = digits.replace(/^0+/, '')
  } else {
    // Bare national number.
    national = digits
  }

  // Ghana NSN is 9 digits; mobile numbers start with 2 or 5.
  const validLength = GHANA.nsnLengths.includes(national.length)
  const validPrefix = /^[25]/.test(national)
  const valid = validLength && validPrefix

  const e164 = `+${GHANA.dial}${national}`
  return {
    raw,
    e164,
    valid,
    reason: valid ? undefined : validLength ? 'not a Ghana mobile number' : 'length',
  }
}

/**
 * Split a blob of pasted text into candidate numbers. People paste with
 * newlines, commas, semicolons, or spaces between numbers.
 */
export function splitRecipients(blob: string): string[] {
  return blob
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
