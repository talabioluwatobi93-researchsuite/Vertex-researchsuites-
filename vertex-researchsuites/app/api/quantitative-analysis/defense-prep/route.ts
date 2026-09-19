export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQuantChapter5Chain } from '@/lib/openrouter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function stripFences(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim()
}

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
    if (!session.interpretation) {
      return NextResponse.json({ error: 'Please generate the full interpretation before preparing for your defense.' }, { status: 400 })
    }

    const framework = session.research_framework || {}
    const results = session.results
    const limitations = session.chapter5_inputs?.limitations || ''

    const prompt = `You are a research methodology expert preparing a student for their thesis/dissertation defense. Based ONLY on the actual data below, generate the 20 MOST LIKELY and MOST DIFFICULT questions a supervisor or panel member would ask, each with a clear, confident, well-explained answer.

RESEARCH FRAMEWORK:
Topic: ${framework.topic || 'N/A'}
Research Questions: ${JSON.stringify(framework.researchQuestions || [])}
Hypotheses: ${JSON.stringify(framework.hypotheses || [])}
Objectives: ${JSON.stringify(framework.objectives || [])}

ACTUAL COMPUTED RESULTS (use only these numbers, never invent any): ${JSON.stringify(results, null, 2)}

INTERPRETATION (already written, use as factual basis): ${session.interpretation}

DISCUSSION (already written): ${session.discussion || 'Not available'}

LIMITATIONS: ${limitations || 'Not explicitly provided — infer only obvious, defensible limitations from sample size and design, do not invent specifics.'}

TASK:
Generate exactly 20 question-and-answer pairs, prioritizing:
1. Why a specific statistical test was chosen over alternatives (e.g. Pearson vs Spearman, paired vs independent t-test, why mediation/moderation was appropriate)
2. Any borderline, weak, or surprising result (small effect size, p-value close to .05, low R-squared, a rejected hypothesis)
3. Sample size, sampling method, and generalizability concerns
4. How findings relate back to the research questions and hypotheses
5. Practical or theoretical implications of the findings
6. Limitations of the study design or data
7. Any construct, scale, or measurement choice that could be challenged

Group each question under ONE of these categories: "Methodology", "Statistical Results", "Limitations", "Implications & Contribution".

GUARDRAILS (do not skip):
- Do NOT invent any statistic, finding, or limitation not present in the data above.
- Do NOT exceed 20 questions. Prioritize the hardest and most likely questions over quantity.
- Write answers in clear, confident, first-person-defensible academic English (as the student would say it), 3-5 sentences each.
- If a hypothesis was rejected or a result was weak, address it honestly — do not spin it as a success.

Respond ONLY with valid JSON, no preamble, no markdown fences, in exactly this format:
[
  { "category": "string", "question": "string", "answer": "string" }
]`

    let raw: string
    try {
      const result = await callQuantChapter5Chain(prompt)
      raw = result.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Defense prep generation failed' }, { status: 500 })
    }

    let defense_prep_content: any
    try {
      defense_prep_content = JSON.parse(stripFences(raw))
    } catch (parseErr) {
      return NextResponse.json({ error: 'Could not parse defense prep response: ' + raw.slice(0, 300) }, { status: 500 })
    }

    if (!Array.isArray(defense_prep_content)) {
      return NextResponse.json({ error: 'Defense prep returned unexpected format.' }, { status: 500 })
    }

    const defensePrepReadyAt = new Date().toISOString()

    await supabase
      .from('quantitative_analysis_sessions')
      .update({
        defense_prep_content,
        defense_prep_paid: true,
        defense_prep_ready_at: defensePrepReadyAt,
        defense_prep_revealed: false
      })
      .eq('id', sessionId)

    return NextResponse.json({ defense_prep_content, defense_prep_ready_at: defensePrepReadyAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Defense prep generation failed' }, { status: 500 })
  }
}
