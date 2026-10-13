import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
} from 'docx'
import * as XLSX from 'xlsx'
import { splitTranscript } from '@/lib/qualBlocks'

export type QualExportInput = {
  results: any
  themes: { name: string; description?: string }[]
  assignments: any[]
  agreement: any
  framework: any
  rawTranscript: string
}

const FONT = 'Times New Roman'

export async function loadQualExportInput(supabaseClient: any, sessionId: string, results: any): Promise<QualExportInput> {
  const { data, error } = await supabaseClient
    .from('qualitative_analysis_sessions')
    .select('quote_assignments, themes, agreement, research_framework, raw_transcript')
    .eq('id', sessionId)
    .single()
  if (error || !data) throw new Error('Could not load your report data.')
  return {
    results,
    themes: data.themes || [],
    assignments: (data.quote_assignments || []).filter((a: any) => !a.removed),
    agreement: data.agreement || null,
    framework: data.research_framework || {},
    rawTranscript: data.raw_transcript || '',
  }
}

export function qualFileName(input: QualExportInput, label: string, ext: string): string {
  const topic = String(input.framework?.topic || 'Qualitative')
    .replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).slice(0, 6).join('_')
  return (topic || 'Qualitative') + '_' + label + '.' + ext
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.setAttribute('download', filename)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function run(text: string, o: any = {}) {
  return new TextRun({ text, font: FONT, size: 24, ...o })
}
function bodyPara(text: string) {
  return new Paragraph({ children: [run(text)], spacing: { line: 480 }, indent: { firstLine: 720 } })
}
function cell(text: string, w: `${number}%`, bold = false) {
  return new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [run(text, { size: 22, bold })] })],
  })
}

function codebookTable(rows: any[]) {
  const head = new TableRow({
    tableHeader: true,
    children: [cell('Theme', '25%', true), cell('Definition', '45%', true), cell('Mentions (N)', '15%', true), cell('%', '15%', true)],
  })
  const body = rows.map((r) => new TableRow({
    children: [
      cell(String(r.theme || ''), '25%'), cell(String(r.definition || ''), '45%'),
      cell(String(r.mentions ?? ''), '15%'), cell(Number(r.percent || 0).toFixed(2) + '%', '15%'),
    ],
  }))
  return new Table({ width: { size: '100%', type: WidthType.PERCENTAGE }, rows: [head, ...body] })
}

export async function buildQualWordBlob(input: QualExportInput): Promise<Blob> {
  const lines = String(input.results?.narrative || '').split('\n').filter(Boolean)
  const kids: any[] = []
  kids.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [run('Chapter 4: Results', { bold: true, size: 28 })],
  }))
  if (input.framework?.topic) kids.push(new Paragraph({ children: [run(String(input.framework.topic), { italics: true })] }))
  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      kids.push(new Paragraph({
        heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
        children: [run(line.slice(3), { bold: true })],
      }))
    } else if (line.startsWith('> \u2014')) {
      kids.push(new Paragraph({ indent: { left: 720 }, spacing: { after: 240 }, children: [run(line.slice(2), { size: 22 })] }))
    } else if (line.startsWith('> ')) {
      kids.push(new Paragraph({ indent: { left: 720 }, spacing: { after: 40 }, children: [run(line.slice(2), { italics: true })] }))
    } else {
      kids.push(bodyPara(line))
    }
    if (i === 0 && Array.isArray(input.results?.codebookTable) && input.results.codebookTable.length) {
      kids.push(new Paragraph({ spacing: { before: 240 }, children: [run('Table 4.1', { bold: true })] }))
      kids.push(new Paragraph({ spacing: { after: 120 }, children: [run('Codebook of Themes', { italics: true })] }))
      kids.push(codebookTable(input.results.codebookTable))
      kids.push(new Paragraph({ children: [run('')] }))
    }
  })
  const doc = new Document({ sections: [{ children: kids }] })
  return Packer.toBlob(doc)
}

function codeOf(names: string[], theme: string): string {
  const i = names.indexOf(theme)
  return i >= 0 ? 'T' + (i + 1) : ''
}

export function buildQualExcelBlob(input: QualExportInput): Blob {
  const names = input.themes.map((t) => t.name)
  const sorted = [...input.assignments].sort((a, b) => {
    const d = names.indexOf(a.theme) - names.indexOf(b.theme)
    return d !== 0 ? d : (a.blockIndex ?? 1e9) - (b.blockIndex ?? 1e9)
  })
  const ledger: any[][] = [['Quote ID', 'Transcript', 'Participant', 'Paragraph', 'Verbatim quote', 'Code', 'Theme']]
  sorted.forEach((a, i) => {
    ledger.push([
      'Q' + String(i + 1).padStart(3, '0'), 'Transcript 1', a.participantId || '',
      a.blockIndex ?? '', String(a.quote || ''), codeOf(names, a.theme), String(a.theme || ''),
    ])
  })
  const cb: any[] = Array.isArray(input.results?.codebookTable) ? input.results.codebookTable : []
  const book: any[][] = [['Code', 'Theme', 'Definition', 'N', '%']]
  input.themes.forEach((t, i) => {
    const r = cb.find((x) => x.theme === t.name)
    book.push(['T' + (i + 1), t.name, t.description || '', r ? r.mentions : '', r ? Number(r.percent) : ''])
  })
  const res = input.agreement?.result
  const agree: any[][] = [['Measure', 'Value']]
  if (res) {
    agree.push(['Cohen\u2019s kappa', res.kappa ?? 'not available'], ['Reading', res.level || ''],
      ['Percent agreement', res.percentAgreement ?? ''], ['Paragraphs compared', res.unitsCompared ?? ''],
      ['Small sample (under 30 paragraphs)', res.smallSample ? 'yes' : 'no'], ['Note', res.message || ''])
  } else agree.push(['Agreement', 'not calculated'])
  const la = input.agreement?.labelsA || {}
  const lb = input.agreement?.labelsB || {}
  const dis: any[][] = [['Paragraph', 'Participant', 'Excerpt', 'Coder A theme', 'Coder B theme']]
  if (!Object.keys(lb).length) dis.push(['', '', 'Coder B labels were not available for this analysis.', '', ''])
  else {
    const blocks = splitTranscript(input.rawTranscript)
    blocks.forEach((b: any) => {
      const a = la[b.index]; const c = lb[b.index]
      if (a !== undefined && c !== undefined && a !== c) {
        dis.push([b.index, b.participantId || '', String(b.text || '').slice(0, 300), a, c])
      }
    })
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ledger), 'Quote ledger')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(book), 'Codebook')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(agree), 'Agreement')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dis), 'Coder disagreements')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
