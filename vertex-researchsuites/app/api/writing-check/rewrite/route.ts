import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { flaggedSections } = await req.json()

    if (!flaggedSections || !Array.isArray(flaggedSections) || flaggedSections.length === 0) {
      return NextResponse.json({ error: 'No flagged content provided.' }, { status: 400 })
    }

    const rewrites = []

    for (const section of flaggedSections) {
      const prompt = `You are an academic writing tutor. A student's sentence or passage was flagged as reading generically, unoriginal, or AI-like. Rewrite it below so it:
- Sounds natural and human, in simple, clear English
- Keeps the exact same meaning and key facts
- Uses varied, genuine sentence structure (not robotic or overly formal)
- Is roughly the same length as the original

Only output the rewritten text. No preamble, no explanation, no quotation marks.

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
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const rewrittenText = data.content?.[0]?.text || section.text

      rewrites.push({
        id: section.id,
        original: section.text,
        rewritten: rewrittenText.trim(),
      })
    }

    return NextResponse.json({ rewrites })
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong while improving the writing.' }, { status: 500 })
  }
}
