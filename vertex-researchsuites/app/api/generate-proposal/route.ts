import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { institution, course, department, interest, sequence, chosenTopic, researchType, problemStatement } = await req.json()

    const prompt = `You are an experienced academic research supervisor in Nigeria, writing a complete, full-length research proposal for a student. Write with genuine depth and detail — this must be a comprehensive, submission-ready document of approximately 15 pages (around 4,000-4,500 words), not a summary.

Student details:
Institution: ${institution}
Course of study: ${course}
Department: ${department}
${interest ? `Research interest: ${interest}` : ''}
${sequence ? `Additional focus: ${sequence}` : ''}
${researchType === 'applied' ? `This is APPLIED research. The student described the underlying problem as: "${problemStatement}". The Statement of the Problem, Significance, and Methodology sections must clearly stay grounded in solving this real problem.` : `This is PURE (basic) research, aimed at generating new knowledge/theory rather than solving one specific applied problem.`}

Chosen topic:
${chosenTopic}

Write the full proposal with these sections, each thoroughly developed:

1. Background of the Study (detailed context, several paragraphs)
2. Statement of the Problem (clear articulation of the gap/issue)
3. Objectives of the Study (one general objective, 3-4 specific objectives, each explained)
4. Research Questions (3-4 clear questions, each with brief explanation of what it investigates)
5. Significance of the Study (who benefits and how, several paragraphs)
6. Research Methodology (research design, population/sample, data collection method, analysis approach — described in real detail)

After the 6 sections, add TWO more sections:

7. Feasibility Note
Explain honestly why this topic is realistic for a Nigerian undergraduate/postgraduate student to complete within a typical academic timeframe — consider data access, cost, and local context.

8. Supervisor's Likely Feedback
Write 2-3 realistic points a supervisor might push back on regarding this proposal, and suggest how the student could address each one.

Finally, add:

9. Suggested References
Provide a short list of illustrative example references in APA format relevant to this topic area. Clearly label this section: "Note: These are illustrative examples only. Verify all references independently and replace with real, current sources before submission." Do not present these as verified real papers.

Write in clear, professional academic English appropriate for a Nigerian university context. Do not include any preamble or closing remarks outside the numbered sections.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const proposal = data.content?.[0]?.text || 'Could not generate the full proposal at this time.'

    return NextResponse.json({ proposal })
  } catch (error) {
    return NextResponse.json({ proposal: 'Something went wrong generating the proposal. Please try again.' }, { status: 500 })
  }
}
