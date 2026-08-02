import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { institution, course, department, sequence } = await req.json()

    const prompt = `You are an experienced academic research supervisor in Nigeria. A student has given you these details:
Institution: ${institution}
Course of study: ${course}
Department: ${department}
${sequence ? `Additional focus/interest: ${sequence}` : ''}

Generate exactly 5 well-dated, current, and academically acceptable research topics suitable for this student's field of study and institution level in Nigeria. Write in simple, clear English that a Nigerian undergraduate or postgraduate student and their supervisor can easily understand.

For EACH of the 5 topics, write a FULL research proposal containing all of these sections, clearly labeled:

Topic [number]: [Title]

1. Background of the Study (short paragraph explaining the context and why this topic matters)
2. Statement of the Problem (what gap or issue this research addresses)
3. Objectives of the Study (one general objective, and 3-4 specific objectives)
4. Research Questions (3-4 clear questions the study will answer)
5. Significance of the Study (who benefits and why it matters)
6. Research Methodology (brief description of how the study would be carried out — research design, population/sample if relevant, data collection method)

Separate each of the 5 topics clearly with a line of dashes (----------) between them. Do not include any preamble, introduction, or closing remarks — start directly with "Topic 1" and end after "Topic 5".`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
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
