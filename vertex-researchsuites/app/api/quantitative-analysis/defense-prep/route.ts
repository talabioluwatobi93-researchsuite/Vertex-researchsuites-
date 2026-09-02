export const maxDuration = 60;

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

    if (error || !session || !session.results) {
      return NextResponse.json({ error: 'Chapter 4 results not found. Please complete your main analysis first.' }, { status: 404 })
    }

    const framework = session.research_framework || {}
    const results = session.results

    const prompt = `You are a research methodology expert preparing a student for their thesis/dissertation defense. Based ONLY on the actual data below, generate likely defense questions with clear, confident answers a student could give.

RESEARCH FRAMEWORK:
Topic: ${framework.topic || 'N/A'}
Hypotheses: ${JSON.stringify(framework.hypotheses || [])}

ACTUAL COMPUTED RESULTS (use only these numbers, never invent any):
${JSON.stringify(results, null, 2)}

Generate questions covering these categories:
1. "Results" — one question per notable finding across every table (descriptives, frequency, correlation if present, regression if present). Cover every construct and every significant relationship, not just the most important ones.
2. "Methodology" — why this statistical method was chosen (e.g. Pearson correlation vs Spearman, "Enter" method vs Stepwise regression, if applicable).
3. "Interpreting Statistics" — plain-language questions like "What does R-squared of X mean in practice?" or "Is your sample size adequate?", using the actual numbers from the results.
4. "Reliability & Rigor" — anticipate a supervisor probing for weaknesses given the actual sample size and design.

Respond with ONLY a valid JSON array, no other text, no markdown code fences, in exactly this format:
[
  { "category": "Results", "question": "...", "answer": "..." },
  { "category": "Methodology", "question": "...", "answer": "..." }
]

Each answer should be 2-4 sentences, confident and academic in tone, referencing the actual numbers where relevant. Generate at least 8 questions total, spread across all four categories.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Defense prep generation failed' }, { status: 500 })
    }

    const rawText = data.content
      .map((block: any) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim()

    let defense_prep_content
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      defense_prep_content = JSON.parse(cleaned)
    } catch (parseErr) {
      return NextResponse.json({ error: 'Could not parse defense prep response. Please try again.' }, { status: 500 })
    }

    const defensePrepReadyAt = new Date().toISOString()

      await supabase
        .from('quantitative_analysis_sessions')
        .update({ defense_prep_content, defense_prep_paid: true, defense_prep_ready_at: defensePrepReadyAt, defense_prep_revealed: false })
      .eq('id', sessionId)

    return NextResponse.json({ defense_prep_content, defense_prep_ready_at: defensePrepReadyAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Defense prep generation failed' }, { status: 500 })
  }
}
