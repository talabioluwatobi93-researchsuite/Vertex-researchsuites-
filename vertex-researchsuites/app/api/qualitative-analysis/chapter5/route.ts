export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQualChapter5Chain } from '@/lib/openrouter'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    const { data: session, error } = await supabase.from('qualitative_analysis_sessions').select('*').eq('id', sessionId).single()
    if (error || !session || !session.results) return NextResponse.json({ error: 'Results not found. Please complete your main analysis first.' }, { status: 404 })

    if (!session.chapter5_inputs) return NextResponse.json({ error: 'Missing Chapter 5 inputs.' }, { status: 400 })

    const framework = session.research_framework || {}
    const inputs = session.chapter5_inputs
    const apaVersion = framework.apaVersion || '7th edition'

    const prompt = `You are a research methodology expert writing Chapter 5 (Summary, Conclusion, and Recommendations) of a student's academic thesis/dissertation based on a qualitative study, following the standard departmental format. Use strict APA ${apaVersion} style, formal academic tone, no first person, no AI-sounding phrases.

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(framework.researchQuestions || [])}
OBJECTIVES: ${JSON.stringify(framework.objectives || [])}

PROBLEM STATEMENT (student-provided): ${inputs.problemStatement}
METHODOLOGY (student-provided): ${inputs.methodology}
LIMITATIONS (student-provided): ${inputs.limitations}

RESULTS (already generated, use as factual basis, do not invent findings not present here): ${JSON.stringify(session.results, null, 2)}

Write Chapter 5 with exactly these five sections, each with a clear heading on its own line:
5.1 Introduction
5.2 Summary
5.3 Conclusion
5.4 Limitations
5.5 Recommendations
5.5.1 Recommendations based on findings
5.5.2 Recommendations for further studies

Rules: Do not invent quotes or themes not present in the Results above. Output plain text only, no markdown, no bullet points.`

    let chapter5_content: string
    try {
      const result = await callQualChapter5Chain(prompt)
      chapter5_content = result.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Chapter 5 generation failed' }, { status: 500 })
    }

    const chapter5ReadyAt = new Date().toISOString()
    await supabase.from('qualitative_analysis_sessions').update({ chapter5_content, chapter5_paid: true, chapter5_ready_at: chapter5ReadyAt, chapter5_revealed: false }).eq('id', sessionId)
    return NextResponse.json({ chapter5_content, chapter5_ready_at: chapter5ReadyAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chapter 5 generation failed' }, { status: 500 })
  }
}
