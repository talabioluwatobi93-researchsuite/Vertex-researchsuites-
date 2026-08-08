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
      return NextResponse.json({ error: 'Results not found. Run calculation first.' }, { status: 404 })
    }

    const framework = session.research_framework || {}
    const results = session.results
    const apaVersion = framework.apaVersion || '7th edition'

    const prompt = `You are a research methodology expert writing the Results and Discussion sections of a student's academic thesis/dissertation. Use strict APA ${apaVersion} style, formal academic tone, no first person, no AI-sounding phrases.

RESEARCH FRAMEWORK:
Topic: ${framework.topic || 'N/A'}
Research Questions: ${JSON.stringify(framework.researchQuestions || [])}
Hypotheses: ${JSON.stringify(framework.hypotheses || [])}
Objectives: ${JSON.stringify(framework.objectives || [])}

CALCULATED STATISTICAL RESULTS (already computed, do not recalculate, just interpret):
${JSON.stringify(results, null, 2)}

Write your response in exactly two parts, separated by the exact line "===DISCUSSION===" (nothing else on that line).

PART 1 (before the separator) — Results, table by table:
1. Briefly restate the sample size and demographic composition using the frequency tables.
2. Report descriptive statistics narratively (referencing Table numbers as "Table 1", "Table 2" etc in the order: Descriptives, Frequency, Correlation if present, Regression if present).
3. If correlation results are present, interpret the strength and direction of each significant relationship (p < .05).
4. If regression results are present, interpret R-squared as percentage of variance explained, report the F-test significance, and interpret each significant predictor's Beta coefficient in plain academic language.
5. Do not draw conclusions about hypotheses yet in this part — stay descriptive and table-by-table.

PART 2 (after the separator) — General Findings & Discussion:
1. Synthesize the results into a cohesive narrative, not a repeat of Part 1.
2. Explicitly state which hypotheses are supported and which are not supported, referencing the specific statistics that justify each conclusion.
3. Tie findings back to the stated research questions and objectives.
4. Keep this part free of table references — it should read as a discussion, not a results recap.

General rules for both parts: Do not invent any numbers not present in the data above. Do not use decorative language. Output plain text only, structured in short academic paragraphs, no markdown headers or bullet points.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'AI interpretation failed' }, { status: 500 })
    }

    const fullText = data.content
      .map((block: any) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')

    const splitIndex = fullText.indexOf('===DISCUSSION===')
    let resultsText = fullText
    let discussionText = ''

    if (splitIndex !== -1) {
      resultsText = fullText.slice(0, splitIndex).trim()
      discussionText = fullText.slice(splitIndex + '===DISCUSSION==='.length).trim()
    }

    const interpretation = resultsText
    const discussion = discussionText

    await supabase
      .from('quantitative_analysis_sessions')
      .update({ interpretation, discussion })
      .eq('id', sessionId)

    return NextResponse.json({ interpretation, discussion })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Interpretation failed' }, { status: 500 })
  }
}
