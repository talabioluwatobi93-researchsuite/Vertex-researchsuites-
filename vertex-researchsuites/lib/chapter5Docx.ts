import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { triggerDownload } from './proposalDocx'

export type QA = { category: string; question: string; answer: string }
type HL = (typeof HeadingLevel)[keyof typeof HeadingLevel]
const FONT = 'Times New Roman'

export function splitReferences(text: string): { body: string; refs: string[] } {
  const t = text || ''
  const re = /\n\s*(?:#+\s*)?References\s*\n/gi
  let last = -1
  let len = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(t)) !== null) { last = m.index; len = m[0].length }
  if (last < 0) return { body: t.trim(), refs: [] }
  const refs = t.slice(last + len).split('\n')
    .map(s => s.trim().replace(/^[-*]\s+/, '')).filter(Boolean)
  return { body: t.slice(0, last).trim(), refs }
}

export function parseQA(raw: unknown): QA[] {
  let v: unknown = raw
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch { return [] } }
  if (!Array.isArray(v)) return []
  return v.filter((x: any) => x && typeof x === 'object').map((x: any) => ({
    category: String(x.category || 'General'),
    question: String(x.question || ''),
    answer: String(x.answer || ''),
  })).filter(q => q.question)
}

function para(text: string, bold = false): Paragraph {
  return new Paragraph({
    spacing: { after: 160, line: 360 },
    children: [new TextRun({ text, bold, font: FONT, size: 24 })],
  })
}

function heading(text: string, level: HL): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text, bold: true, font: FONT, size: 28 })],
  })
}

export async function buildMergedBlob(chapter5: string, qa: QA[]): Promise<Blob> {
  const { body, refs } = splitReferences(chapter5)
  const kids: Paragraph[] = [heading('Chapter 5', HeadingLevel.HEADING_1)]
  for (const line of body.split('\n').map(s => s.trim()).filter(Boolean)) {
    const isHead = /^5\.\d+[\s.:]/.test(line) && line.length < 120
    kids.push(isHead ? heading(line, HeadingLevel.HEADING_2) : para(line))
  }
  if (qa.length) {
    kids.push(heading('Defense Preparation: Likely Questions and Answers', HeadingLevel.HEADING_1))
    const cats: string[] = []
    for (const q of qa) if (!cats.includes(q.category)) cats.push(q.category)
    let n = 0
    for (const cat of cats) {
      kids.push(heading(cat, HeadingLevel.HEADING_2))
      for (const q of qa.filter(x => x.category === cat)) {
        n += 1
        kids.push(para('Q' + n + '. ' + q.question, true))
        kids.push(para(q.answer))
      }
    }
  }
  if (refs.length) {
    kids.push(heading('References', HeadingLevel.HEADING_1))
    for (const r of refs) kids.push(new Paragraph({
      spacing: { after: 160, line: 360 },
      indent: { left: 720, hanging: 720 },
      children: [new TextRun({ text: r, font: FONT, size: 24 })],
    }))
  }
  return Packer.toBlob(new Document({ sections: [{ children: kids }] }))
}

export async function mergeAndDownload(
  sb: SupabaseClient, table: string, id: string
): Promise<'done' | 'not_ready' | 'error'> {
  try {
    const { data, error } = await sb.from(table)
      .select('chapter5_paid, chapter5_content, chapter5_revealed, defense_prep_paid, defense_prep_content, defense_prep_revealed')
      .eq('id', id).single()
    if (error || !data) return 'error'
    const d: any = data
    const qa = parseQA(d.defense_prep_content)
    const ready = d.chapter5_paid && d.chapter5_revealed && d.chapter5_content
      && d.defense_prep_paid && d.defense_prep_revealed && qa.length > 0
    if (!ready) return 'not_ready'
    const blob = await buildMergedBlob(String(d.chapter5_content), qa)
    triggerDownload(blob, 'Chapter5_and_Defense_Prep.docx')
    return 'done'
  } catch { return 'error' }
}
