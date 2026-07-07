/**
 * Parse an uploaded Excel/CSV file into headers + row objects using SheetJS.
 * Also includes a heuristic to guess which column holds the phone numbers.
 */
import * as XLSX from 'xlsx'

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
