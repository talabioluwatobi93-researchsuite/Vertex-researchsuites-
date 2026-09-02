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

    if (!session.chapter5_inputs) {
      return NextResponse.json({ error: 'Missing Chapter 5 inputs.' }, { status: 400 })
    }

    const framework = session.research_framework || {}
    const inputs = session.chapter5_inputs
    const apaVersion = framework.apaVersion || '7th edition'

    const prompt = `You are a research methodology expert writing Chapter 5 (Summary, Conclusion, and Recommendations) of a student's academic thesis/dissertation, following the standard Mass Communication department format. Use strict APA ${apaVersion} style, formal academic tone, no first person, no AI-sounding phrases.

RESEARCH FRAMEWORK:
Topic: ${framework.topic || 'N/A'}
Research Questions: ${JSON.stringify(framework.researchQuestions || [])}
Hypotheses: ${JSON.stringify(framework.hypotheses || [])}
Objectives: ${JSON.stringify(framework.objectives || [])}

PROBLEM STATEMENT (student-provided):
${inputs.problemStatement}

METHODOLOGY (student-provided):
${inputs.methodology}

LIMITATIONS (student-provided, may be lightly edited from a suggested draft):
${inputs.limitations}

CHAPTER 4 RESULTS (already computed and interpreted, use as the factual basis \u2014 do not recalculate or invent numbers):
${JSON.stringify(session.results, null, 2)}

CHAPTER 4 DISCUSSION (already written):
${session.discussion || 'Not available'}

Write Chapter 5 with exactly these five numbered sections, each with a clear heading on its own line exactly as written below:

5.1 Introduction
Briefly reintroduce the purpose of the study, referencing the Problem Statement and Objectives provided above.

5.2 Summary
Summarize the Methodology provided above and the key findings from Chapter 4, in plain narrative form \u2014 no statistics tables, just prose.

5.3 Conclusion
Draw a conclusion for the study as a whole, directly grounded in the Chapter 4 results and discussion above. Do not introduce new claims not supported by the data.

5.4 Limitations
Present the Limitations provided above in polished academic prose, expanding only where it stays consistent with what the student wrote \u2014 do not invent new limitations they did not mention.

5.5 Recommendations
5.5.1 Recommendations based on findings \u2014 practical recommendations that follow directly from what was found in Chapter 4.
5.5.2 Recommendations for further studies \u2014 suggest reasonable directions for future research based on gaps or limitations of this study.

Rules: Do not invent any numbers not present in the Chapter 4 results above. Do not use decorative language. Output plain text only, with each of the five section headings written exactly as shown above on their own line, followed by the section's prose paragraphs. No markdown formatting, no bullet points.`

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
      return NextResponse.json({ error: data.error?.message || 'Chapter 5 generation failed' }, { status: 500 })
    }

    const chapter5_content = data.content
      .map((block: any) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')

    const chapter5ReadyAt = new Date().toISOString()

      await supabase
        .from('quantitative_analysis_sessions')
        .update({ chapter5_content, chapter5_paid: true, chapter5_ready_at: chapter5ReadyAt, chapter5_revealed: false })
      .eq('id', sessionId)

    return NextResponse.json({ chapter5_content, chapter5_ready_at: chapter5ReadyAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chapter 5 generation failed' }, { status: 500 })
  }
}
