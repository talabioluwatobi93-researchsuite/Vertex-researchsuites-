export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    const { data: session, error } = await supabase.from('qualitative_analysis_sessions').select('*').eq('id', sessionId).single()
    if (error || !session || !session.results) return NextResponse.json({ error: 'Results not found. Please complete your main analysis first.' }, { status: 404 })

    const framework = session.research_framework || {}
    const results = session.results

    const prompt = `You are a research methodology expert preparing a student for their thesis/dissertation defense on a qualitative study. Based ONLY on the actual data below, generate likely defense questions with clear, confident answers.

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESULTS (themes, quotes, frequency \u2014 use only this, never invent):
${JSON.stringify(results, null, 2)}

Generate questions covering these categories:
1. "Coding & Themes" \u2014 why specific quotes were grouped under specific themes; ask about at least 3 different themes present in the data.
2. "Methodology" \u2014 why Thematic Analysis, Content Analysis, or both were chosen; how themes were identified.
3. "Findings" \u2014 what the frequency/prevalence of themes suggests, referencing actual numbers if a frequency table is present.
4. "Rigor & Trustworthiness" \u2014 anticipate a supervisor probing for credibility, given the data available.

Respond with ONLY a valid JSON array, no other text, no markdown code fences:
[{ "category": "Coding & Themes", "question": "...", "answer": "..." }]

Each answer 2-4 sentences, confident academic tone. Generate at least 8 questions across all categories.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] })
    })
    const data = await response.json()
    if (!response.ok) return NextResponse.json({ error: data.error?.message || 'Defense prep generation failed' }, { status: 500 })

    const rawText = data.content.map((b: any) => (b.type === 'text' ? b.text : '')).filter(Boolean).join('\n').trim()
    let defense_prep_content
    try {
      defense_prep_content = JSON.parse(rawText.replace(/```json|```/g, '').trim())
    } catch (e) {
      return NextResponse.json({ error: 'Could not parse defense prep response. Please try again.' }, { status: 500 })
    }

    const defensePrepReadyAt = new Date().toISOString()
      await supabase.from('qualitative_analysis_sessions').update({ defense_prep_content, defense_prep_paid: true, defense_prep_ready_at: defensePrepReadyAt, defense_prep_revealed: false }).eq('id', sessionId)
    return NextResponse.json({ defense_prep_content, defense_prep_ready_at: defensePrepReadyAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Defense prep generation failed' }, { status: 500 })
  }
}
