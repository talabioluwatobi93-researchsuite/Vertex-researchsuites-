import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { institution, course, department, interest, sequence, researchType, problemStatement, userCategory } = await req.json()

    const prompt = `You are an experienced academic research supervisor in Nigeria. A student has given you these details:
Institution: ${institution}
Course of study: ${course}
Department: ${department}
${interest ? `Research interest: ${interest}` : ''}
${sequence ? `Additional focus/interest: ${sequence}` : ''}
${researchType === 'applied' ? `This is APPLIED research, meaning it must address a specific, real-world problem. The student (a ${userCategory || 'researcher'}) described the problem as: "${problemStatement}". Every topic must be clearly tied to solving this problem.` : `This is PURE (basic) research, meaning it should focus on generating new knowledge or theoretical understanding rather than solving one specific practical problem.`}

Generate exactly 5 well-dated, current, and academically acceptable research topic ideas suitable for this student's field of study and institution level in Nigeria. Write in simple, clear English that a Nigerian undergraduate or postgraduate student and their supervisor can easily understand.

For EACH of the 5 topics, write ONLY:
Topic [number]: [Title]
A short 2-3 sentence summary explaining what the study would be about and why it matters.

Do not write full proposals yet — these are previews only, so the student can choose one to expand later.

Separate each topic clearly with a line of dashes (----------) between them. Do not include any preamble, introduction, or closing remarks — start directly with "Topic 1" and end after "Topic 5".`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
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
