/**
 * Phone-book import via the Contact Picker API.
 *
 * Only Chrome/Edge on Android ship this — iOS Safari and every desktop browser
 * do not, so callers must gate the UI on `contactsAvailable()` and leave file
 * upload as the path for everyone else.
 *
 * The browser shows a native picker and returns ONLY the contacts the user taps;
 * the page never sees the full phone book and there is no persistent permission.
 *
 * Results are shaped into a ParsedSheet so an import reuses the same column
 * mapping, {{merge}} fields, de-duplication and validation as an uploaded file.
 */
import type { ParsedSheet } from './csv'
import { normalizePhone } from './phone'

interface ContactInfo {
  name?: string[]
  tel?: string[]
}

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactInfo[]>
  getProperties(): Promise<string[]>
}

declare global {
  interface Navigator {
    contacts?: ContactsManager
    userAgentData?: { mobile?: boolean }
  }
}

// Column names for the synthesized sheet. NAME doubles as the {{Name}} merge token.
export const NAME_COLUMN = 'Name'
export const PHONE_COLUMN = 'Phone'

export interface ContactImport {
  sheet: ParsedSheet
  /** How many contacts the user tapped. */
  picked: number
  /** Of those, how many carried no phone number and were dropped. */
  withoutNumber: number
}

/**
 * Sync capability check. The API also requires a secure context and a top-level
 * browsing context — it throws inside an iframe, which no amount of feature
 * detection reveals, so `pickContacts` still handles failure.
 */
function hasContactsApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    window.top === window.self &&
    'contacts' in navigator &&
    'ContactsManager' in window
  )
}

// getProperties() is stable per browser; cache it so tab-visibility checks are cheap.
let propsCache: string[] | null = null
async function availableProperties(): Promise<string[]> {
  if (propsCache) return propsCache
  propsCache = (await navigator.contacts!.getProperties()) ?? []
  return propsCache
}

/**
 * Whether to offer phone-book import at all. Async because support for individual
 * properties is queried at runtime — requesting one the browser doesn't back
 * makes select() throw.
 */
export async function contactsAvailable(): Promise<boolean> {
  if (!hasContactsApi()) return false
  try {
    return (await availableProperties()).includes('tel')
  } catch {
    return false
  }
}

/**
 * Whether it's worth telling this user that phone-book import exists elsewhere.
 * Only on desktop: their Android phone is plausibly within reach, so the nudge is
 * actionable. On an iPhone it would just advertise hardware they don't own.
 */
export function isDesktop(): boolean {
  if (typeof navigator === 'undefined') return false
  const mobile = navigator.userAgentData?.mobile
  if (typeof mobile === 'boolean') return !mobile
  // Safari and Firefox have no userAgentData, so fall back to the UA string.
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * One number per contact — a person should get one message even if their card
 * lists several numbers. Prefer the first that's a valid Ghana mobile; otherwise
 * keep the first number as-is so it surfaces in the UI as skipped rather than
 * vanishing silently.
 */
function pickNumber(tels: string[] | undefined): string {
  if (!tels?.length) return ''
  return tels.find((t) => normalizePhone(t).valid) ?? tels[0]
}

/**
 * Open the native picker. Resolves to null when the user dismisses it without
 * choosing anyone. Throws if the browser refuses the request.
 */
export async function pickContacts(): Promise<ContactImport | null> {
  if (!hasContactsApi()) {
    throw new Error('This browser cannot open your phone book. Upload a file instead.')
  }

  const supported = await availableProperties()
  if (!supported.includes('tel')) {
    throw new Error('This browser cannot share phone numbers. Upload a file instead.')
  }
  // Names are a bonus — import still works without them.
  const wanted = ['tel', 'name'].filter((p) => supported.includes(p))

  const picked = await navigator.contacts!.select(wanted, { multiple: true })
  if (!picked.length) return null

  const rows: Record<string, string>[] = []
  let withoutNumber = 0
  for (const contact of picked) {
    const phone = pickNumber(contact.tel)
    if (!phone) {
      withoutNumber++
      continue
    }
    rows.push({
      [NAME_COLUMN]: contact.name?.[0]?.trim() ?? '',
      [PHONE_COLUMN]: phone,
    })
  }

  // Only offer a Name column if at least one contact actually had a name — an
  // empty column would just be a merge token that renders to nothing.
  const hasNames = rows.some((r) => r[NAME_COLUMN])
  const headers = hasNames ? [NAME_COLUMN, PHONE_COLUMN] : [PHONE_COLUMN]
  if (!hasNames) rows.forEach((r) => delete r[NAME_COLUMN])

  return {
    sheet: { fileName: 'Phone contacts', headers, rows },
    picked: picked.length,
    withoutNumber,
  }
}
