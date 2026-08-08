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
      .from('qualitative_analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session || !session.quote_assignments || !session.themes) {
      return NextResponse.json({ error: 'Coded data not found. Please complete Step 4 first.' }, { status: 404 })
    }

    const framework = session.research_framework || {}
    const themes: any[] = session.themes || []
    const assignments: any[] = session.quote_assignments || []
    const analysisTypes: string[] = session.analysis_type || []
    const apaVersion = framework.apaVersion || '7th edition'

    // theme frequency for Content Analysis
    const frequency: Record<string, number> = {}
    themes.forEach((t) => { frequency[t.name] = 0 })
    assignments.forEach((a) => {
      if (frequency[a.theme] !== undefined) frequency[a.theme]++
    })
    const totalQuotes = assignments.length
    const frequencyTable = Object.entries(frequency).map(([theme, count]) => ({
      theme,
      count,
      percent: totalQuotes > 0 ? Math.round((count / totalQuotes) * 10000) / 100 : 0
    }))

    const groupedQuotes: Record<string, string[]> = {}
    assignments.forEach((a) => {
      if (!groupedQuotes[a.theme]) groupedQuotes[a.theme] = []
      groupedQuotes[a.theme].push(a.quote)
    })

    const prompt = `You are a qualitative research expert writing the Results chapter (Chapter 4) of a student's academic thesis/dissertation, presenting a ${analysisTypes.join(' and ')} analysis. Use strict APA ${apaVersion} style, formal academic tone, no first person, no AI-sounding phrases.

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(framework.researchQuestions || [])}
OBJECTIVES: ${JSON.stringify(framework.objectives || [])}

CONFIRMED THEMES WITH SUPPORTING QUOTES (student-reviewed and confirmed \u2014 use exactly as given, do not alter the quotes):
${JSON.stringify(groupedQuotes, null, 2)}

${analysisTypes.includes('content') ? `THEME FREQUENCY (for Content Analysis):\n${JSON.stringify(frequencyTable, null, 2)}` : ''}

Write the Results chapter with the following structure:
${analysisTypes.includes('thematic') ? '- A Thematic Analysis section: present each theme with a short introduction, then weave in the supporting quotes naturally (quoted directly, attributed generically e.g. "as one respondent noted"), tying each theme back to the research questions/objectives.' : ''}
${analysisTypes.includes('content') ? '- A Content Analysis section: present the frequency table narratively, discussing which themes were most/least prevalent and what that suggests.' : ''}
- Close with a brief paragraph synthesizing how these findings relate to the stated research questions and objectives.

Rules: Do not invent any quotes not provided above. Do not invent frequency numbers not provided above. Output plain text only, structured in short academic paragraphs, no markdown formatting, no bullet points.`

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
      return NextResponse.json({ error: data.error?.message || 'Report generation failed' }, { status: 500 })
    }

    const narrative = data.content
      .map((block: any) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')

    const results = {
      themeCount: themes.length,
      quoteCount: assignments.length,
      frequencyTable: analysisTypes.includes('content') ? frequencyTable : null,
      groupedQuotes: analysisTypes.includes('thematic') ? groupedQuotes : null,
      narrative,
      computedAt: new Date().toISOString()
    }

    await supabase
      .from('qualitative_analysis_sessions')
      .update({ results, status: 'completed' })
      .eq('id', sessionId)

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Report generation failed' }, { status: 500 })
  }
}
