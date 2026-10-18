// Chapter 5 sources. Code finds and checks the sources. The model only places
// markers such as [S1]; code turns each marker into a citation. The model never
// writes an author or a year, and the reference list holds only cited sources.
import { searchVerifiedRefs, formatReference } from './citationVerify'
import type { VerifiedRef } from './citationVerify'

export interface SourceItem { id: string; ref: VerifiedRef }
export interface GatherResult { sources: SourceItem[]; fromYear: number | null; note: string }

export const SOURCES_NOTE =
  'The sources listed here were found through CrossRef and OpenAlex and confirmed to exist. ' +
  'They were matched to statements by title only. Read each source and confirm that it supports ' +
  'the statement it is attached to before you submit.'

export function styleFromApaVersion(apaVersion: string | null | undefined): 'APA6' | 'APA7' {
  return String(apaVersion || '').includes('6') ? 'APA6' : 'APA7'
}

const NO_SOURCES_NOTE =
  'No verified sources relevant to this topic were found, so this chapter cites none.'

export async function gatherSources(
  topic: string, themeNames: string[], max: number = 8, now: Date = new Date()
): Promise<GatherResult> {
  const t = String(topic || '').trim()
  if (t.split(/\s+/).filter(Boolean).length < 3) {
    return {
      sources: [], fromYear: null,
      note: 'No sources were searched because the research topic is too short to search reliably. ' + NO_SOURCES_NOTE,
    }
  }
  const queries: Array<{ q: string; n: number }> = [{ q: t, n: 4 }]
  for (const name of (themeNames || []).slice(0, 3)) {
    const nm = String(name || '').trim()
    if (nm) queries.push({ q: t + ' ' + nm, n: 3 })
  }
  const batches = await Promise.all(queries.map(async (x) => {
    try { return await searchVerifiedRefs(x.q, x.n, now) } catch (e) { return null }
  }))
  const seen = new Set<string>()
  const refs: VerifiedRef[] = []
  let fromYear: number | null = null
  for (const b of batches) {
    if (!b) continue
    if (fromYear === null) fromYear = b.fromYear
    for (const r of b.refs) {
      const k = String(r.doi || r.url || r.title).toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      refs.push(r)
      if (refs.length >= max) break
    }
    if (refs.length >= max) break
  }
  const sources = refs.map((ref, i) => ({ id: 'S' + (i + 1), ref }))
  const allFailed = batches.every((b) => b === null)
  const note = sources.length > 0 ? ''
    : allFailed ? 'The source search could not be completed, so this chapter cites none.'
    : NO_SOURCES_NOTE
  return { sources, fromYear, note }
}

export function sourceListForPrompt(sources: SourceItem[]): string {
  return sources.map((s) => '[' + s.id + '] ' + s.ref.title + ' (' + s.ref.year + '), ' + s.ref.journal).join('\n')
}

function inTextCitation(ref: VerifiedRef): string {
  const A = ref.authors || []
  let who: string
  if (A.length === 0) who = ref.title.split(/\s+/).slice(0, 4).join(' ')
  else if (A.length === 1) who = A[0].family
  else if (A.length === 2) who = A[0].family + ' & ' + A[1].family
  else who = A[0].family + ' et al.'
  return who + ', ' + ref.year
}

export interface ApplyResult { text: string; usedIds: string[]; unknownMarkers: number }

export function applyCitations(text: string, sources: SourceItem[]): ApplyResult {
  const byId = new Map<string, SourceItem>()
  for (const s of sources) byId.set(s.id, s)
  const used: string[] = []
  let unknown = 0
  const out = String(text || '').replace(/\[S\d+\](?:\s?\[S\d+\])*/g, (m: string) => {
    const parts: string[] = []
    for (const id of m.match(/S\d+/g) || []) {
      const s = byId.get(id)
      if (!s) { unknown++; continue }
      if (used.indexOf(id) < 0) used.push(id)
      const c = inTextCitation(s.ref)
      if (parts.indexOf(c) < 0) parts.push(c)
    }
    return parts.length ? '(' + parts.join('; ') + ')' : ''
  })
  const tidy = out.replace(/[ \t]+([.,;:])/g, '$1').replace(/[ \t]{2,}/g, ' ')
  return { text: tidy, usedIds: used, unknownMarkers: unknown }
}

// Author-year citations the model wrote by itself are not verified. Parenthetical
// ones are removed. Narrative ones such as "Smith (2019)" are counted and flagged.
const PAREN_CITE = /[ \t]?\(\s*[A-Z][A-Za-z\u00C0-\u024F'’-]+(?: et al\.|,? (?:and|&) [A-Z][A-Za-z\u00C0-\u024F'’-]+)?,\s*(?:19|20)\d{2}[a-z]?(?:\s*;\s*[^()]*?)?\)/g
const NARRATIVE_CITE = /\b[A-Z][A-Za-z\u00C0-\u024F'’-]+(?: et al\.| (?:and|&) [A-Z][A-Za-z\u00C0-\u024F'’-]+)? \((?:19|20)\d{2}[a-z]?\)/g

export function stripUnmarkedCitations(text: string): { text: string; removed: number; narrativeFlags: number } {
  const t = String(text || '')
  const removed = (t.match(PAREN_CITE) || []).length
  const narrativeFlags = (t.match(NARRATIVE_CITE) || []).length
  return { text: t.replace(PAREN_CITE, ''), removed, narrativeFlags }
}

export function buildReferenceList(sources: SourceItem[], usedIds: string[], style: string): string[] {
  const rows: Array<{ key: string; line: string }> = []
  for (const id of usedIds) {
    const s = sources.find((x) => x.id === id)
    if (!s) continue
    const first = s.ref.authors && s.ref.authors.length ? s.ref.authors[0].family : s.ref.title
    rows.push({ key: first.toLowerCase(), line: formatReference(s.ref, style) })
  }
  rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return rows.map((r) => r.line)
}

export function citationCheckNote(removed: number, narrativeFlags: number, unknownMarkers: number): string {
  const bits: string[] = []
  if (removed > 0) bits.push(removed + ' citation(s) written without a verified source were removed')
  if (unknownMarkers > 0) bits.push(unknownMarkers + ' citation marker(s) did not match a verified source and were removed')
  if (narrativeFlags > 0) bits.push(narrativeFlags + ' in-text mention(s) of an author and year could not be matched to a verified source; check them before you submit')
  return bits.length ? 'Citation check: ' + bits.join('; ') + '.' : ''
}
