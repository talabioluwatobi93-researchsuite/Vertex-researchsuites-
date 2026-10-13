// Phase 9 Q6a: deterministic builders for the qualitative report.
// Code decides every number, quote and attribution. The AI only writes prose.

export type Assignment = {
  theme: string
  quote: string
  removed?: boolean
  blockIndex?: number
  participantId?: string
  speaker?: string | null
}
export type ThemeDef = { name: string; description?: string }
export type CodebookRow = { theme: string; definition: string; mentions: number; percent: number }

export const FRAMEWORK_LINE =
  'Methodological Framework: Inductive Thematic Analysis adhering to Braun & Clarke (2006) protocol.'

// "P_03" -> "Participant 3", "Speaker_2" -> "Speaker 2"
export function participantLabel(id?: string): string {
  if (!id) return 'A participant'
  const p = id.match(/^P_0*(\d+)$/i)
  if (p) return 'Participant ' + p[1]
  const s = id.match(/^Speaker_0*(\d+)$/i)
  if (s) return 'Speaker ' + s[1]
  return id.replace(/_/g, ' ')
}

// Up to `max` confirmed quotes for a theme: first by paragraph order, then
// prefer a different participant for the corroborating quote.
export function pickQuotes(assignments: Assignment[], theme: string, max = 2): Assignment[] {
  const own = assignments
    .filter((a) => !a.removed && a.theme === theme && a.quote)
    .sort((a, b) => (a.blockIndex ?? 1e9) - (b.blockIndex ?? 1e9))
  const out: Assignment[] = []
  for (const a of own) {
    if (out.length >= max) break
    if (!out.some((o) => o.participantId && o.participantId === a.participantId)) out.push(a)
  }
  for (const a of own) {
    if (out.length >= max) break
    if (!out.includes(a)) out.push(a)
  }
  return out
}

// Mention counts per theme. Prefer Coder A's paragraph labels; fall back to the
// number of confirmed quotes when no labels exist.
export function mentionCounts(
  themeNames: string[],
  labels: Record<string, string> | undefined,
  assignments: Assignment[]
): { counts: Record<string, number>; total: number; source: 'coder' | 'quotes' } {
  const counts: Record<string, number> = {}
  themeNames.forEach((n) => (counts[n] = 0))
  let source: 'coder' | 'quotes' = 'coder'
  let total = 0
  if (labels) {
    for (const t of Object.values(labels)) {
      if (counts[t] !== undefined) {
        counts[t]++
        total++
      }
    }
  }
  if (total === 0) {
    source = 'quotes'
    for (const a of assignments) {
      if (!a.removed && counts[a.theme] !== undefined) {
        counts[a.theme]++
        total++
      }
    }
  }
  return { counts, total, source }
}

export function buildCodebookTable(themes: ThemeDef[], counts: Record<string, number>, total: number): CodebookRow[] {
  return themes.map((t) => ({
    theme: t.name,
    definition: t.description || '',
    mentions: counts[t.name] || 0,
    percent: total > 0 ? Math.round(((counts[t.name] || 0) / total) * 10000) / 100 : 0,
  }))
}

export function agreementStatement(agreement: any): string {
  const r = agreement && agreement.result
  if (!r) return 'Inter-coder agreement was not calculated for this analysis.'
  let s = 'Inter-coder agreement. Two independent automated coders (Coder A and Coder B) each assigned participant paragraphs to one of the confirmed themes, or to none. '
  if (r.kappa === null || r.kappa === undefined) {
    s += 'Cohen\u2019s kappa could not be calculated for this transcript.'
  } else {
    s += 'Across ' + r.unitsCompared + ' paragraphs they gave the same label to ' + r.percentAgreement +
      '% (Cohen\u2019s \u03BA = ' + Number(r.kappa).toFixed(2) + ', ' + r.level + ' agreement; ' +
      (r.reliable ? 'at or above' : 'below') + ' the commonly used 0.61 threshold).'
  }
  if (r.failedBatches && r.failedBatches.length > 0) {
    s += ' Part ' + r.failedBatches.join(', ') + ' of the transcript could not be checked and is excluded from this figure.'
  }
  if (agreement.decision === 'proceed') s += ' The researcher reviewed this result and chose to proceed.'
  return s
}

export function quoteLines(a: Assignment): string[] {
  const where = a.participantId ? '[' + a.participantId + (a.blockIndex ? ', paragraph ' + a.blockIndex : '') + ']' : ''
  return ['> \u201C' + a.quote + '\u201D', '> \u2014 ' + participantLabel(a.participantId) + ' ' + where]
}

// A long quoted passage in model prose is a likely invented quote: reject it.
export function hasLongQuotedSpan(text: string): boolean {
  return /["\u201C][^"\u201D]{40,}["\u201D]/.test(text)
}

export function cleanProse(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 20 || hasLongQuotedSpan(t)) return null
  return t
}

export type ThemeProse = { claim: string | null; synthesis: string | null }

export function fallbackClaim(name: string, mentions: number, percent: number): string {
  return 'The theme "' + name + '" was identified in ' + mentions + ' coded paragraph' + (mentions === 1 ? '' : 's') +
    ' (' + percent + '% of all theme mentions).'
}

// Line markers used by the results page: "## " heading, "> " block quote.
export function assembleNarrative(input: {
  themes: ThemeDef[]
  rows: CodebookRow[]
  assignments: Assignment[]
  prose: Record<string, ThemeProse>
  includeThematic: boolean
  contentText?: string | null
  synthesisText?: string | null
  agreementText: string
}): string {
  const out: string[] = [FRAMEWORK_LINE, input.agreementText]
  if (input.includeThematic) {
    input.themes.forEach((t, i) => {
      const row = input.rows[i]
      const p = input.prose[t.name] || { claim: null, synthesis: null }
      out.push('## Theme ' + (i + 1) + ': ' + t.name)
      out.push(p.claim || fallbackClaim(t.name, row ? row.mentions : 0, row ? row.percent : 0))
      const qs = pickQuotes(input.assignments, t.name, 2)
      if (qs.length === 0) {
        out.push('No confirmed quotes were retained for this theme.')
      }
      qs.forEach((q, k) => {
        if (k === 0) {
          out.push(participantLabel(q.participantId) + ' stated:')
        } else if (q.participantId && q.participantId !== qs[0].participantId) {
          out.push('This was corroborated by ' + participantLabel(q.participantId) + ':')
        } else {
          out.push('A further excerpt from the same participant reads:')
        }
        out.push(...quoteLines({ ...q, quote: q.quote.replace(/\s+/g, ' ') }))
      })
      if (p.synthesis) out.push('Analytical synthesis: ' + p.synthesis)
    })
  }
  if (input.contentText) {
    out.push('## Content Analysis')
    out.push(input.contentText)
  }
  if (input.synthesisText) {
    out.push('## Synthesis')
    out.push(input.synthesisText)
  }
  return out.join('\n')
}
