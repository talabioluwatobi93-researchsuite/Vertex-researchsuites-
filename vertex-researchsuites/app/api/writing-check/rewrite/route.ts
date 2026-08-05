import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { flaggedSections } = await req.json()

    if (!flaggedSections || !Array.isArray(flaggedSections) || flaggedSections.length === 0) {
      return NextResponse.json({ error: 'No flagged content provided.' }, { status: 400 })
    }

    const rewrites = []

    for (const section of flaggedSections) {
      const prompt = `You are a thoughtful academic writing tutor helping a Nigerian student strengthen a passage from their own work.

Rewrite the passage below so it:
- Sounds like it was written by the student themselves — natural, confident, and a little imperfect, the way real people write
- Uses varied sentence length and rhythm (mix short and longer sentences, avoid every sentence following the same structure)
- Avoids stiff, textbook-style phrasing and overused academic transitions ("Moreover," "Furthermore," "It is evident that")
- Keeps the exact same meaning and key facts as the original
- Is roughly the same length as the original

Then, briefly explain in one or two friendly sentences what made the original passage weaker, and what you changed to strengthen it — write this the way a supportive tutor would talk to a student, not a technical report.

Respond in this exact format:
REWRITE: [your rewritten passage]
NOTE: [your brief, friendly explanation]

Original passage:
"${section.text}"`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-5',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const fullText = data.content?.[0]?.text || ''

      const rewriteMatch = fullText.match(/REWRITE:\s*([\s\S]*?)(?=\nNOTE:|$)/)
      const noteMatch = fullText.match(/NOTE:\s*([\s\S]*)/)

      const rewrittenText = rewriteMatch ? rewriteMatch[1].trim() : fullText.trim()
      const note = noteMatch ? noteMatch[1].trim() : ''

      rewrites.push({
        id: section.id,
        original: section.text,
        rewritten: rewrittenText,
        note: note,
      })
    }

    return NextResponse.json({ rewrites })
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong while improving the writing.' }, { status: 500 })
  }
}
