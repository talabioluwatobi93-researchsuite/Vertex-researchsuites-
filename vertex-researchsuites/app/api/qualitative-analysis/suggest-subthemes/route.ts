export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQualCoderAChain } from '@/lib/openrouter'
import { requireSessionOwner } from '@/lib/qualAuth'
import { splitTranscript } from '@/lib/qualBlocks'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const MAX_CHARS = 120000

type Sub = { name: string; description: string; paragraphs: number[] }

function transcriptForPrompt(raw: string): { text: string; sampled: boolean; shown: Set<number> } {
  const blocks = splitTranscript(raw)
  const lines = blocks.map(
    (b) => `[${b.index}] ${b.speaker ? b.speaker + ': ' : ''}${b.text}`
  )
  const full = lines.join('\n')
  if (full.length <= MAX_CHARS) {
    return { text: full, sampled: false, shown: new Set(blocks.map((b) => b.index)) }
  }
  const k = Math.ceil(full.length / MAX_CHARS)
  const shown = new Set<number>()
  const kept = lines.filter((_, i) => {
    if (i % k === 0) {
      shown.add(blocks[i].index)
      return true
    }
    return false
  })
  return { text: kept.join('\n'), sampled: true, shown }
}

function parseSubs(
  raw: string,
  themeNames: string[],
  shown: Set<number>
): Record<string, Sub[]> | null {
  const m = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!m) return null
  let arr: any
  try {
    arr = JSON.parse(m[0])
  } catch {
    return null
  }
  if (!Array.isArray(arr)) return null

  const out: Record<string, Sub[]> = {}
  const byKey = new Map<string, string>()
  themeNames.forEach((n) => {
    out[n] = []
    byKey.set(n.trim().toLowerCase(), n)
  })

  const seen = new Set<string>()
  let total = 0
  for (const item of arr) {
    const orig = byKey.get(String(item?.theme || '').trim().toLowerCase())
    if (!orig || !Array.isArray(item?.subthemes)) continue
    for (const s of item.subthemes) {
      if (out[orig].length >= 4) break
      const name = typeof s?.name === 'string' ? s.name.trim().slice(0, 80) : ''
      if (!name) continue
      const nk = name.toLowerCase()
      if (seen.has(nk) || byKey.has(nk)) continue
      const paras: number[] = Array.isArray(s?.paragraphs)
        ? Array.from(
            new Set(
              s.paragraphs
                .map((p: any) => Number(p))
                .filter((p: number) => Number.isInteger(p) && shown.has(p))
            )
          ).slice(0, 6) as number[]
        : []
      if (paras.length === 0) continue
      seen.add(nk)
      out[orig].push({
        name,
        description: typeof s?.description === 'string' ? s.description.trim().slice(0, 200) : '',
        paragraphs: paras,
      })
      total++
    }
  }
  return total > 0 ? out : null
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const own = await requireSessionOwner(req, supabase, sessionId, 'raw_transcript, research_framework, themes')
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status })
    const session = own.session
    if (!session.raw_transcript) {
      return NextResponse.json({ error: 'Transcript not found.' }, { status: 404 })
    }
    const themes: { name: string; description?: string }[] = Array.isArray(session.themes)
      ? session.themes
      : []
    if (themes.length === 0) {
      return NextResponse.json({ error: 'Please confirm your themes first.' }, { status: 400 })
    }

    const framework = session.research_framework || {}
    const { text, sampled, shown } = transcriptForPrompt(String(session.raw_transcript))
    const themeNames = themes.map((t) => String(t.name))
    const themeList = themes
      .map((t, i) => `${i + 1}. ${t.name}${t.description ? ' - ' + t.description : ''}`)
      .join('\n')

    const prompt = `You are a qualitative research expert doing thematic analysis (Braun & Clarke). The researcher has confirmed the themes below. Propose sub-themes for EACH theme.

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(framework.researchQuestions || [])}

CONFIRMED THEMES:
${themeList}

TRANSCRIPT (each paragraph starts with its number in square brackets). Base sub-themes on what the PARTICIPANTS say; use interviewer lines only for context:
${text}

Rules:
- For each theme give 2 to 4 sub-themes. Give fewer only if the transcript truly supports fewer. Never pad.
- A sub-theme is a distinct aspect or dimension INSIDE its parent theme. It must not repeat the parent theme, and no two sub-themes may overlap.
- Every sub-theme must be clearly present in the transcript. For each, list the numbers of 1 to 4 paragraphs that show it. Use only paragraph numbers that appear in the transcript above. Do not invent numbers or content.
- Give each a short clear name (a few words) and a one-sentence description.
- Use the exact theme names given above.

Respond with ONLY a valid JSON array, no other text, no markdown code fences, in exactly this format:
[
  { "theme": "Exact theme name", "subthemes": [
    { "name": "Sub-theme name", "description": "One sentence describing it.", "paragraphs": [3, 12] }
  ] }
]`

    let rawText: string
    try {
      const result = await callQualCoderAChain(prompt, 25000)
      rawText = result.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Sub-theme suggestion failed' }, { status: 500 })
    }

    const subthemes = parseSubs(rawText, themeNames, shown)
    if (!subthemes) {
      return NextResponse.json(
        { error: 'Could not produce usable sub-themes. Please try again.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ subthemes, sampled })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sub-theme suggestion failed' }, { status: 500 })
  }
}
