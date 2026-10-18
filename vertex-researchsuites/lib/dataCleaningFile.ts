// Reads an Excel sheet into a grid and writes the cleaned file.
// Only the coded cells are replaced, so dates, other sheets and column widths stay as they were.
import * as XLSX from 'xlsx'
import { applyCodings, buildCodebook, CodedQuestion, Grid, isBlank } from './dataCleaning'

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
// Keep equal to MAX_SAVE_BYTES in lib/dataCleaningServer.ts (hosting body limit).
export const SAVE_LIMIT_BYTES = 4 * 1024 * 1024

export interface LoadedSheet { sheetNames: string[]; sheetName: string; grid: Grid }
export interface CleanedFile { blob: Blob; replaced: number; unmapped: number; codebookSheet: string }

const READ_OPTS = { type: 'array' as const, cellNF: true }
const JSON_OPTS = { header: 1 as const, defval: null, blankrows: true }

// A sheet range can start above the header (empty rows at the top).
// The header is the first row that has any content.
function leadingBlankRows(rows: Grid): number {
  const i = rows.findIndex((row) => Array.isArray(row) && row.some((cell) => !isBlank(cell)))
  return i === -1 ? rows.length : i
}

// Reads one sheet (the wanted one, else the first) as rows of cells. Row 0 is the header.
export function loadSheet(buffer: ArrayBuffer, wanted?: string): LoadedSheet {
  const wb = XLSX.read(buffer, READ_OPTS)
  const sheetNames = wb.SheetNames.slice()
  const sheetName = wanted && sheetNames.indexOf(wanted) !== -1 ? wanted : sheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws || !ws['!ref']) throw new Error('This sheet is empty.')
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, JSON_OPTS) as Grid
  const skip = leadingBlankRows(all)
  if (skip >= all.length) throw new Error('This sheet is empty.')
  return { sheetNames, sheetName, grid: all.slice(skip) }
}

// Excel sheet names are not case sensitive.
function freeSheetName(names: string[], base: string): string {
  const used = names.map((n) => n.toLowerCase())
  if (used.indexOf(base.toLowerCase()) === -1) return base
  for (let n = 2; n < 100; n++) {
    const name = base + ' (' + n + ')'
    if (used.indexOf(name.toLowerCase()) === -1) return name
  }
  return base + ' ' + Date.now()
}

// Re-reads the original file, replaces only the coded cells, adds a Codebook sheet.
export function buildCleanedFile(buffer: ArrayBuffer, sheetName: string, coded: CodedQuestion[]): CleanedFile {
  const wb = XLSX.read(buffer, READ_OPTS)
  const ws = wb.Sheets[sheetName]
  if (!ws || !ws['!ref']) throw new Error('The sheet "' + sheetName + '" was not found.')
  const start = XLSX.utils.decode_range(ws['!ref']).s
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, JSON_OPTS) as Grid
  const skip = leadingBlankRows(all)
  const grid = all.slice(skip)
  const result = applyCodings(grid, coded)
  coded.forEach((q) => {
    for (let r = 1; r < grid.length; r++) {
      const before = (grid[r] || [])[q.col]
      const after = (result.grid[r] || [])[q.col]
      if (typeof after !== 'number' || after === before) continue
      ws[XLSX.utils.encode_cell({ r: start.r + skip + r, c: start.c + q.col })] = { t: 'n', v: after }
    }
  })
  const codebookSheet = freeSheetName(wb.SheetNames, 'Codebook')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildCodebook(coded)), codebookSheet)
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return { blob: new Blob([out], { type: XLSX_MIME }), replaced: result.replaced, unmapped: result.unmapped, codebookSheet }
}

export function cleanedFileName(original: string): string {
  const base = String(original || '').replace(/\.(xlsx|xls)$/i, '').replace(/[\\/:*?"<>|]+/g, '').trim()
  return (base || 'data') + '_coded.xlsx'
}

// Browser only: saves a file to the user's device.
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
