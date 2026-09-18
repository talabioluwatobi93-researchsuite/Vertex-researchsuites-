export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callChapter3ExtractChain } from '@/lib/openrouter'
import { extractTextFromFileOrLink } from '@/lib/extractFileText'

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

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    if (!session.chapter3_file_path && !session.chapter3_link) {
      // Chapter 3 is optional at upload time — this is not a hard error, just
      // nothing to extract. Frontend should treat this as "no extraction available"
      // and go straight to the manual picker without alarming the user.
      return NextResponse.json({ mappingFailed: true, reason: 'no_chapter3_provided' }, { status: 200 })
    }

    let chapter3Text: string
    try {
      chapter3Text = await extractTextFromFileOrLink(
        'quant-session-uploads',
        session.chapter3_file_path,
        session.chapter3_link
      )
    } catch (extractErr: any) {
      console.error('Chapter 3 text extraction failed:', extractErr)
      return NextResponse.json({ extractionFailed: true, reason: 'extraction_failed' }, { status: 200 })
    }

    if (!chapter3Text || !chapter3Text.trim()) {
      return NextResponse.json({ extractionFailed: true, reason: 'empty_chapter3' }, { status: 200 })
    }

    const analysisIntent: string = session.analysis_intent || ''

    const prompt = `You are a research methodology assistant extracting structured information from
a student's Chapter 3 (Methodology) of a thesis/dissertation.

CHAPTER 3 TEXT (extracted from the uploaded document):
"""
${chapter3Text.slice(0, 20000)}
"""

STUDENT'S STATED ANALYSIS INTENT (free text, may be brief or empty):
"${analysisIntent}"

TASK:
Extract the following, using only what is explicitly stated or clearly implied in the text.
Do not invent research questions, hypotheses, or variables that are not supported by the text.

1. researchQuestions: array of strings, the research questions as stated (or closely
   paraphrased if not in question form).
2. objectives: array of strings, the study's objectives.
3. hypotheses: array of objects, each with:
   - "text": the hypothesis as stated
   - "type": "null" or "alternative" if identifiable, else "unspecified"
   - "independentVariable": name of the IV involved, if identifiable, else null
   - "dependentVariable": name of the DV involved, if identifiable, else null
4. variables: object with two arrays:
   - "independent": array of independent variable names mentioned
   - "dependent": array of dependent variable names mentioned

If a section is not present in the text, return an empty array for it rather than guessing.

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "researchQuestions": [],
  "objectives": [],
  "hypotheses": [
    { "text": "", "type": "unspecified", "independentVariable": null, "dependentVariable": null }
  ],
  "variables": { "independent": [], "dependent": [] }
}`

    let chainResult
    try {
      chainResult = await callChapter3ExtractChain(prompt)
    } catch (chainErr: any) {
      console.error('Chapter 3 extraction chain failed on both models:', chainErr)
      return NextResponse.json({ extractionFailed: true, reason: 'ai_unavailable' }, { status: 200 })
    }

    let parsed: any
    try {
      const cleaned = chainResult.content.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (parseErr: any) {
      console.error('Failed to parse Chapter 3 extraction JSON:', parseErr, chainResult.content)
      return NextResponse.json({ extractionFailed: true, reason: 'parse_failed' }, { status: 200 })
    }

    if (
      !parsed ||
      !Array.isArray(parsed.researchQuestions) ||
      !Array.isArray(parsed.objectives) ||
      !Array.isArray(parsed.hypotheses) ||
      !parsed.variables
    ) {
      return NextResponse.json({ extractionFailed: true, reason: 'invalid_shape' }, { status: 200 })
    }

    const { error: updateError } = await supabase
      .from('quantitative_analysis_sessions')
      .update({ chapter3_extraction: parsed })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to save Chapter 3 extraction:', updateError)
      return NextResponse.json({ error: 'Failed to save extraction.' }, { status: 500 })
    }

    return NextResponse.json({
      extraction: parsed,
      providerUsed: chainResult.providerUsed,
    })
  } catch (err: any) {
    console.error('Unexpected error in extract-chapter3 route:', err)
    return NextResponse.json({ error: err.message || 'Extraction failed.' }, { status: 500 })
  }
}
