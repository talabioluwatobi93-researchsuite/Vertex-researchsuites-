// Quantitative data cleaning: turns word answers into numbers.
// Pure code. No AI model, no network, no file upload to a server.
export type Cell = unknown
export type Grid = Cell[][]

// Advice only, never blocks a column: very many different answers usually means free text.
export const FREE_TEXT_HINT_AT = 25

export interface WordOption { key: string; label: string; count: number }
export interface CodedEntry { key: string; label: string; code: number }
export interface CodedQuestion { col: number; question: string; entries: CodedEntry[] }

function cleanLabel(v: Cell): string {
  return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim()
}

// Same word in different capitals or with extra spaces gets the same key.
export function normText(v: Cell): string {
  return cleanLabel(v).toLowerCase()
}

export function isBlank(v: Cell): boolean {
  return cleanLabel(v) === ''
}

export function headerText(grid: Grid, col: number): string {
  return cleanLabel((grid[0] || [])[col])
}

// Exact header match wins. Otherwise every header that contains the typed text.
export function findColumns(grid: Grid, query: string): number[] {
  const q = normText(query)
  if (q === '') return []
  const header = grid[0] || []
  const exact: number[] = []
  const partial: number[] = []
  for (let c = 0; c < header.length; c++) {
    const h = normText(header[c])
    if (h === '') continue
    if (h === q) exact.push(c)
    else if (h.indexOf(q) !== -1) partial.push(c)
  }
  return exact.length > 0 ? exact : partial
}

// Distinct answers in the order they first appear. Blank cells are ignored.
export function distinctWords(grid: Grid, col: number): WordOption[] {
  const seen = new Map<string, WordOption>()
  for (let r = 1; r < grid.length; r++) {
    const v = (grid[r] || [])[col]
    if (isBlank(v)) continue
    const key = normText(v)
    const hit = seen.get(key)
    if (hit) hit.count++
    else seen.set(key, { key, label: cleanLabel(v), count: 1 })
  }
  return Array.from(seen.values())
}

export function isAllNumeric(words: WordOption[]): boolean {
  return words.length > 0 && words.every((w) => Number.isFinite(Number(w.key)))
}

// Cells whose answer holds a comma or semicolon (possible multi-answer cells).
export function multiAnswerCells(words: WordOption[]): number {
  return words.filter((w) => /[,;]/.test(w.label)).reduce((n, w) => n + w.count, 0)
}

// Returns a plain-words reason when a column cannot be coded, else null.
export function columnProblem(words: WordOption[]): string | null {
  if (words.length === 0) return 'This column has no answers.'
  if (isAllNumeric(words)) return 'This column already contains numbers.'
  return null
}

// Used only to show a hint and to let the user skip. Never removes a column.
export function looksLikeFreeText(words: WordOption[]): boolean {
  return words.length > FREE_TEXT_HINT_AT
}

// Every column after startCol that has word answers. The user can skip any of them.
export function suggestQuestionColumns(grid: Grid, startCol: number): number[] {
  const width = (grid[0] || []).length
  const out: number[] = []
  for (let c = Math.max(0, startCol); c < width; c++) {
    if (headerText(grid, c) === '') continue
    if (columnProblem(distinctWords(grid, c)) === null) out.push(c)
  }
  return out
}

// True when both columns have exactly the same answer words (ignoring capitals and spaces).
export function sameWordSet(a: WordOption[], b: { key: string }[]): boolean {
  if (a.length !== b.length) return false
  const keys = new Set<string>(b.map((x) => x.key))
  return a.every((w) => keys.has(w.key))
}

// Most recent already-coded question with an identical answer set, else null.
export function findIdenticalCoded(words: WordOption[], coded: CodedQuestion[]): CodedQuestion | null {
  for (let i = coded.length - 1; i >= 0; i--) {
    if (sameWordSet(words, coded[i].entries)) return coded[i]
  }
  return null
}

// Numbers (as text for the input boxes) copied from an identical earlier question.
export function copyCodes(words: WordOption[], source: CodedQuestion): string[] {
  const byKey = new Map<string, number>()
  source.entries.forEach((e) => byKey.set(e.key, e.code))
  return words.map((w) => {
    const n = byKey.get(w.key)
    return n === undefined ? '' : String(n)
  })
}

// Only plain numbers are accepted: 1, 12, -1, 2.5
export function parseCode(text: string): number | null {
  const t = String(text === undefined || text === null ? '' : text).trim()
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

export interface CodeCheck { ok: boolean; missing: number[]; invalid: number[]; duplicates: number[][] }

// codes[i] belongs to words[i]. Duplicates are a warning, not an error.
export function validateCodes(words: WordOption[], codes: string[]): CodeCheck {
  const missing: number[] = []
  const invalid: number[] = []
  const groups = new Map<number, number[]>()
  words.forEach((_w, i) => {
    const t = String(codes[i] === undefined || codes[i] === null ? '' : codes[i]).trim()
    if (t === '') { missing.push(i); return }
    const n = parseCode(t)
    if (n === null) { invalid.push(i); return }
    const g = groups.get(n)
    if (g) g.push(i)
    else groups.set(n, [i])
  })
  const duplicates = Array.from(groups.values()).filter((g) => g.length > 1)
  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid, duplicates }
}

export function buildCoded(col: number, question: string, words: WordOption[], codes: string[]): CodedQuestion | null {
  if (!validateCodes(words, codes).ok) return null
  const entries: CodedEntry[] = words.map((w, i) => ({ key: w.key, label: w.label, code: parseCode(codes[i]) as number }))
  return { col, question, entries }
}

export interface ApplyResult { grid: Grid; replaced: number; unmapped: number }

// Returns a NEW grid. The input is never changed. Blank cells stay blank.
// A word with no number is left as it is and counted in "unmapped".
export function applyCodings(grid: Grid, coded: CodedQuestion[]): ApplyResult {
  const maps = coded.map((q) => {
    const m = new Map<string, number>()
    q.entries.forEach((e) => m.set(e.key, e.code))
    return { col: q.col, m }
  })
  let replaced = 0
  let unmapped = 0
  const out: Grid = grid.map((row, r) => {
    const copy: Cell[] = Array.isArray(row) ? row.slice() : []
    if (r === 0) return copy
    maps.forEach((x) => {
      const v = copy[x.col]
      if (isBlank(v)) return
      const n = x.m.get(normText(v))
      if (n === undefined) { unmapped++; return }
      copy[x.col] = n
      replaced++
    })
    return copy
  })
  return { grid: out, replaced, unmapped }
}

// Sheet 2 of the download: what every word was changed to.
export function buildCodebook(coded: CodedQuestion[]): Grid {
  const rows: Grid = [['Question', 'Answer (word)', 'Number']]
  coded.forEach((q) => q.entries.forEach((e) => rows.push([q.question, e.label, e.code])))
  return rows
}
