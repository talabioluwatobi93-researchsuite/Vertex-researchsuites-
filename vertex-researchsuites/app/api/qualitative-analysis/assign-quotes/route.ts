export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQualStep1Chain } from '@/lib/openrouter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('qualitative_analysis_sessions')
      .select('raw_transcript, themes')
      .eq('id', sessionId)
      .single()

    if (error || !session || !session.raw_transcript || !session.themes) {
      return NextResponse.json({ error: 'Transcript or themes not found. Please complete Step 3 first.' }, { status: 404 })
    }

    const themeNames = (session.themes as any[]).map((t) => t.name)

    const prompt = `You are a qualitative research expert doing thematic coding on an interview transcript.

CONFIRMED THEMES:
${themeNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

TRANSCRIPT:
${session.raw_transcript.slice(0, 15000)}

Find direct quotes/excerpts from the transcript that illustrate each theme. Use the EXACT wording from the transcript for each quote \u2014 do not paraphrase or invent quotes. Find 2 to 5 quotes per theme where possible. If a theme has no clear supporting quote in the transcript, skip it rather than inventing one.

Respond with ONLY a valid JSON array, no other text, no markdown code fences, in exactly this format:
[
  { "theme": "Theme name exactly as given above", "quote": "exact quote from the transcript" }
]`

    let rawText: string
    try {
      const result = await callQualStep1Chain(prompt)
      rawText = result.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Quote assignment failed' }, { status: 500 })
    }

    let assignments
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      assignments = JSON.parse(cleaned)
    } catch (parseErr) {
      return NextResponse.json({ error: 'Could not parse quote assignments. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ assignments })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Quote assignment failed' }, { status: 500 })
  }
}
