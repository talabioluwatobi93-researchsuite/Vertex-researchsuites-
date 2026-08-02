import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { institution, course, department, sequence } = await req.json()

    const prompt = `You are an academic research supervisor in Nigeria. A student has given you these details:
Institution: ${institution}
Course of study: ${course}
Department: ${department}
${sequence ? `Additional focus/interest: ${sequence}` : ''}

Generate exactly 5 well-dated, current, and academically acceptable research topic proposals suitable for this student's field of study and institution level in Nigeria. Write in simple, clear English.

For each of the 5 topics, provide:
1. The topic title
2. A short 2-3 sentence proposal summary explaining the problem, objective, and relevance

Format your response as plain text with clear numbering (1 to 5), each with "Topic:" and "Proposal:" labels. Do not include any preamble or closing remarks, just the 5 topics directly.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || 'Could not generate topics at this time.'

    return NextResponse.json({ topics: text })
  } catch (error) {
    return NextResponse.json({ topics: 'Something went wrong generating topics. Please try again.' }, { status: 500 })
  }
}
