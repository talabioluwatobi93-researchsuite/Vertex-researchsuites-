export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

import { runQuantInterpretation } from '@/lib/quantInterpret'

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

    if (error || !session || !session.results) {
      return NextResponse.json({ error: 'Results not found. Run calculation first.' }, { status: 404 })
    }

    if (!session.response_rate_info) {
      return NextResponse.json({ error: 'Response rate information is missing.' }, { status: 400 })
    }
    if (!session.reliability_info) {
      return NextResponse.json({ error: 'Reliability information is missing.' }, { status: 400 })
    }

    let interpretation: string
    let discussion: string
    try {
      const citationStyle = session.research_framework?.apaVersion || 'APA7'
    const result = await runQuantInterpretation(session, citationStyle)
      interpretation = result.interpretation
      discussion = result.discussion
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Interpretation generation failed' }, { status: 500 })
    }

    await supabase
      .from('quantitative_analysis_sessions')
      .update({ interpretation, discussion })
      .eq('id', sessionId)

    return NextResponse.json({ interpretation, discussion })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Interpretation failed' }, { status: 500 })
  }
}
