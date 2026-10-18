import { searchVerifiedRefs, verifyCitation, formatReference } from '@/lib/citationVerify'

// Older works the method itself relies on. They are exempt from the recent-years window,
// but each is still checked against CrossRef / OpenAlex before it is listed.
const MANDATED = [
  { key: 'Braun', label: 'Braun and Clarke (2006)', title: 'Using thematic analysis in psychology', year: 2006, family: 'Braun' },
  { key: 'Landis', label: 'Landis and Koch (1977)', title: 'The measurement of observer agreement for categorical data', year: 1977, family: 'Landis' },
]

export type ReferenceBlock = { lines: string[]; flags: string[]; fromYear: number | null; shortfall: number | null }

export function stripReferences(narrative: string): string {
  const i = narrative.indexOf('\n## References')
  return i >= 0 ? narrative.slice(0, i) : narrative
}

export async function buildReferenceBlock(o: { topic: string; style: string; narrative: string; now?: Date }): Promise<ReferenceBlock> {
  const now = o.now || new Date()
  const text = stripReferences(o.narrative)
  const lines: string[] = ['## References']
  const flags: string[] = []
  const seen = new Set<string>()

  for (const m of MANDATED) {
    if (!text.includes(m.key)) continue
    try {
      const v = await verifyCitation({ title: m.title, year: m.year, firstAuthorFamily: m.family }, now)
      if (v.status === 'verified') {
        lines.push(formatReference(v.ref, o.style))
        seen.add(String(v.ref.doi || '').toLowerCase())
        continue
      }
    } catch (e: any) { /* treated as unverified below */ }
    flags.push('Note: the reference for ' + m.label + ' could not be verified automatically. Please check it manually before you submit.')
  }
  flags.forEach((f) => lines.push(f))

  let fromYear: number | null = null
  let shortfall: number | null = null
  const topicFlags: string[] = []
  if (o.topic.trim()) {
    try {
      const r = await searchVerifiedRefs(o.topic, 6, now)
      fromYear = r.fromYear
      shortfall = r.shortfall
      const extra = r.refs.filter((x) => !seen.has(String(x.doi || '').toLowerCase()))
      if (extra.length) {
        lines.push('## Additional verified sources on this topic')
        lines.push('These sources were found through CrossRef and OpenAlex and were published from ' + r.fromYear +
          ' onward. They are listed for your reading and are not cited in the text above; cite them where they are relevant.')
        extra.forEach((x) => lines.push(formatReference(x, o.style)))
      }
      if (r.shortfall > 0) {
        topicFlags.push('Note: only ' + (6 - r.shortfall) + ' of 6 recent verified sources were found for this topic. Please add more recent sources manually.')
      }
    } catch (e: any) {
      topicFlags.push('Note: the search for recent sources on your topic was unavailable. Please add recent sources manually.')
    }
  } else {
    topicFlags.push('Note: no research topic was found, so no topic sources were searched.')
  }
  topicFlags.forEach((f) => lines.push(f))
  return { lines, flags: flags.concat(topicFlags), fromYear, shortfall }
}
