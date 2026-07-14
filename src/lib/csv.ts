/**
 * Parse an uploaded Excel/CSV file into headers + row objects using SheetJS.
 * Also includes a heuristic to guess which column holds the phone numbers.
 */
import * as XLSX from 'xlsx'

// The REAL per-campaign limit: unique, valid recipients actually sent. Mirrors the backend
// guardrail (SmsCampaignService.MaxRecipients = 10000). Enforced at the review step on the
// DEDUPED count — so a file with duplicates that settles under the limit is accepted.
export const MAX_RECIPIENTS = 10000

// Parse-time fail-fast ceiling on RAW rows: well above MAX_RECIPIENTS to allow heavy
// duplication, but bounded so a pathologically huge file can't exhaust browser memory.
export const MAX_SHEET_ROWS = 50000

// Max columns/headers — every column is sent per recipient for {{merge}}, so this bounds payload.
export const MAX_SHEET_COLUMNS = 50

// Thrown when a file is over a limit — carries a user-facing "split the file" message.
export class SheetTooLargeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SheetTooLargeError'
  }
}

export interface ParsedSheet {
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const first = wb.SheetNames[0]
  if (!first) throw new Error('The file has no sheets.')

  const ws = wb.Sheets[first]
  // header:1 gives us an array-of-arrays so we control header handling.
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  })

  if (matrix.length === 0) throw new Error('The file is empty.')

  // Enforce the caps BEFORE building row objects, so an oversized file fails fast instead of
  // allocating hundreds of thousands of rows first.
  const columnCount = (matrix[0] as unknown[]).length
  if (columnCount > MAX_SHEET_COLUMNS)
    throw new SheetTooLargeError(
      `This file has ${columnCount} columns, over the ${MAX_SHEET_COLUMNS}-column limit. Remove the columns your message doesn't use, then upload again.`,
    )
  const dataRowCount = matrix.length - 1 // first row is the header
  if (dataRowCount > MAX_SHEET_ROWS)
    throw new SheetTooLargeError(
      `This file has ${dataRowCount.toLocaleString()} rows — too large to process in one go. Split it into files of up to ${MAX_RECIPIENTS.toLocaleString()} recipients each.`,
    )

  const rawHeaders = (matrix[0] as unknown[]).map((h, i) =>
    String(h ?? '').trim() || `Column ${i + 1}`,
  )
  // De-duplicate header names so column mapping stays unambiguous.
  const seen = new Map<string, number>()
  const headers = rawHeaders.map((h) => {
    const n = seen.get(h) ?? 0
    seen.set(h, n + 1)
    return n === 0 ? h : `${h} (${n + 1})`
  })

  const rows: Record<string, string>[] = []
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[]
    if (!row || row.every((c) => String(c ?? '').trim() === '')) continue
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = String(row[i] ?? '').trim()
    })
    rows.push(obj)
  }

  return { fileName: file.name, headers, rows }
}

/**
 * Guess the phone column by header name first, then by content shape.
 */
export function guessPhoneColumn(sheet: ParsedSheet): string | null {
  const byName = sheet.headers.find((h) =>
    /phone|msisdn|mobile|number|tel|contact|cell/i.test(h),
  )
  if (byName) return byName

  // Fall back: the column whose values most look like phone numbers.
  const sample = sheet.rows.slice(0, 25)
  let best: { header: string; score: number } | null = null
  for (const h of sheet.headers) {
    let score = 0
    for (const row of sample) {
      const v = row[h] ?? ''
      const digits = v.replace(/[^\d]/g, '')
      if (digits.length >= 7 && digits.length <= 15) score++
    }
    if (!best || score > best.score) best = { header: h, score }
  }
  return best && best.score > 0 ? best.header : null
}
