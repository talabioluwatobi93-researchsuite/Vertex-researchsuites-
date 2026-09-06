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
      .select('raw_transcript, research_framework')
      .eq('id', sessionId)
      .single()

    if (error || !session || !session.raw_transcript) {
      return NextResponse.json({ error: 'Transcript not found.' }, { status: 404 })
    }

    const framework = session.research_framework || {}

    const prompt = `You are a qualitative research expert reading an interview/focus-group transcript to identify candidate themes for thematic analysis.

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(framework.researchQuestions || [])}

TRANSCRIPT:
${session.raw_transcript.slice(0, 12000)}

Identify 4 to 8 candidate themes present in this transcript. For each theme, give a short, clear name (a few words) and a one-sentence description of what it captures.

Respond with ONLY a valid JSON array, no other text, no markdown code fences, in exactly this format:
[
  { "name": "Theme name", "description": "One sentence describing what this theme captures." }
]`

    let rawText: string
    try {
      const result = await callQualStep1Chain(prompt)
      rawText = result.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Theme suggestion failed' }, { status: 500 })
    }

    let themes
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      themes = JSON.parse(cleaned)
    } catch (parseErr) {
      return NextResponse.json({ error: 'Could not parse suggested themes. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ themes })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Theme suggestion failed' }, { status: 500 })
  }
}
