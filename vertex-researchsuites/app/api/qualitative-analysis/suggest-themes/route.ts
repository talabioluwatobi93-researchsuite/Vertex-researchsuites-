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

// Whole transcript goes to the model up to this size. Longer ones are sampled
// evenly (every k-th paragraph) so the END of the interview is never ignored.
const MAX_CHARS = 120000

function transcriptForPrompt(raw: string): { text: string; sampled: boolean } {
  const lines = splitTranscript(raw).map(
    (b) => `[${b.index}] ${b.speaker ? b.speaker + ': ' : ''}${b.text}`
  )
  const full = lines.join('\n')
  if (full.length <= MAX_CHARS) return { text: full, sampled: false }
  const k = Math.ceil(full.length / MAX_CHARS)
  return { text: lines.filter((_, i) => i % k === 0).join('\n'), sampled: true }
}

function parseThemes(raw: string): { name: string; description: string }[] | null {
  const m = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!m) return null
  try {
    const arr = JSON.parse(m[0])
    if (!Array.isArray(arr)) return null
    const out = arr
      .filter((t: any) => t && typeof t.name === 'string' && t.name.trim())
      .map((t: any) => ({
        name: String(t.name).trim().slice(0, 80),
        description: typeof t.description === 'string' ? t.description.trim().slice(0, 300) : '',
      }))
      .slice(0, 8)
    return out.length ? out : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const own = await requireSessionOwner(req, supabase, sessionId, 'raw_transcript, research_framework')
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status })
    const session = own.session
    if (!session.raw_transcript) {
      return NextResponse.json({ error: 'Transcript not found.' }, { status: 404 })
    }

    const framework = session.research_framework || {}
    const { text, sampled } = transcriptForPrompt(String(session.raw_transcript))

    const prompt = `You are a qualitative research expert reading an interview/focus-group transcript to identify candidate themes for thematic analysis (Braun & Clarke).

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(framework.researchQuestions || [])}

TRANSCRIPT (each paragraph starts with its number in square brackets). Base themes on what the PARTICIPANTS say; use interviewer lines only for context:
${text}

Identify 4 to 6 candidate themes present across the WHOLE transcript, from beginning to end. For each theme, give a short, clear name (a few words) and a one-sentence description of what it captures.

Respond with ONLY a valid JSON array, no other text, no markdown code fences, in exactly this format:
[
  { "name": "Theme name", "description": "One sentence describing what this theme captures." }
]`

    let rawText: string
    try {
      const result = await callQualCoderAChain(prompt, 25000)
      rawText = result.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Theme suggestion failed' }, { status: 500 })
    }

    const themes = parseThemes(rawText)
    if (!themes) {
      return NextResponse.json({ error: 'Could not parse suggested themes. Please try again.' }, { status: 500 })
    }
    return NextResponse.json({ themes, sampled })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Theme suggestion failed' }, { status: 500 })
  }
}
