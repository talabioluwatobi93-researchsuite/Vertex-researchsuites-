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

    const prompt = `You are a research methodology expert writing the Results section of a student's academic thesis/dissertation. Use strict APA ${apaVersion} style, formal academic tone, no first person, no AI-sounding phrases.

RESEARCH FRAMEWORK:
Topic: ${framework.topic || 'N/A'}
Research Questions: ${JSON.stringify(framework.researchQuestions || [])}
Hypotheses: ${JSON.stringify(framework.hypotheses || [])}
Objectives: ${JSON.stringify(framework.objectives || [])}

CALCULATED STATISTICAL RESULTS (already computed, do not recalculate, just interpret):
${JSON.stringify(results, null, 2)}

Write a Results section that:
1. Briefly restates the sample size and demographic composition using the frequency tables.
2. Reports descriptive statistics narratively (referencing Table numbers as "Table 1", "Table 2" etc in the order: Descriptives, Frequency, Correlation if present, Regression if present).
3. If correlation results are present, interpret the strength and direction of each significant relationship (p < .05) and explicitly state which hypotheses this supports or does not support.
4. If regression results are present, interpret R-squared as percentage of variance explained, report the F-test significance, and interpret each significant predictor's Beta coefficient in plain academic language, tying back to the stated hypotheses.
5. Do not invent any numbers not present in the data above. Do not use decorative language. Output plain text only, structured in short academic paragraphs, no markdown headers or bullet points.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'AI interpretation failed' }, { status: 500 })
    }

    const interpretation = data.content
      .map((block: any) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')

    await supabase
      .from('quantitative_analysis_sessions')
      .update({ interpretation })
      .eq('id', sessionId)

    return NextResponse.json({ interpretation })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Interpretation failed' }, { status: 500 })
  }
}
