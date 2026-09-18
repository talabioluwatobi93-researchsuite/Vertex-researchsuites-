import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      .from('quantitative_analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    const extraction = session.chapter3_extraction

    const hasUsableExtraction =
      extraction &&
      Array.isArray(extraction.researchQuestions) &&
      Array.isArray(extraction.objectives) &&
      Array.isArray(extraction.hypotheses)

    if (!hasUsableExtraction) {
      // No confirmed/usable Chapter 3 extraction yet. Per requirement, do not
      // block — tell the frontend to fall back to the manual 13-test picker.
      return NextResponse.json({ frameworkBuilt: false, reason: 'no_chapter3_extraction' }, { status: 200 })
    }

    const hypothesesText: string[] = extraction.hypotheses.map((h: any) => {
      if (typeof h === 'string') return h
      if (h && typeof h.text === 'string') return h.text
      return ''
    }).filter(Boolean)

    const topic: string =
      (session.analysis_intent && session.analysis_intent.trim()) ||
      extraction.researchQuestions[0] ||
      extraction.objectives[0] ||
      ''

    const researchFramework = {
      topic,
      researchQuestions: extraction.researchQuestions,
      hypotheses: hypothesesText,
      objectives: extraction.objectives,
      // Kept for anything downstream that wants the richer, non-flattened shape.
      variables: extraction.variables || { independent: [], dependent: [] },
    }

    const { error: updateError } = await supabase
      .from('quantitative_analysis_sessions')
      .update({ research_framework: researchFramework })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to save research_framework:', updateError)
      return NextResponse.json({ error: 'Failed to save research framework.' }, { status: 500 })
    }

    return NextResponse.json({ frameworkBuilt: true, researchFramework })
  } catch (err: any) {
    console.error('Unexpected error in build-research-framework route:', err)
    return NextResponse.json({ error: err.message || 'Failed to build research framework.' }, { status: 500 })
  }
}
