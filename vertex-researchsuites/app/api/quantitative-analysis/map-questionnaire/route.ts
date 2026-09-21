export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQuestionnaireMapChain } from '@/lib/openrouter'
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

    console.log("MAP-QUESTIONNAIRE ROUTE HIT, sessionId:", sessionId); const { data: session, error } = await supabase
      .from('quantitative_analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    console.log("SESSION FIELDS:", { file_path: session.questionnaire_file_path, link: session.questionnaire_link, column_headers_len: session.column_headers?.length }); if (!session.questionnaire_file_path && !session.questionnaire_link) {
      return NextResponse.json(
        { error: 'No questionnaire file or link found for this session.' },
        { status: 400 }
      )
    }

    if (!session.column_headers || !Array.isArray(session.column_headers)) {
      return NextResponse.json(
        { error: 'No spreadsheet column headers found for this session.' },
        { status: 400 }
      )
    }

    let questionnaireText: string
    try {
      questionnaireText = await extractTextFromFileOrLink(
        'quant-session-uploads',
        session.questionnaire_file_path,
        session.questionnaire_link
      )
    } catch (extractErr: any) {
      console.error('Questionnaire text extraction failed:', extractErr)
      return NextResponse.json({ mappingFailed: true, reason: 'extraction_failed' }, { status: 200 })
    }

    if (!questionnaireText || !questionnaireText.trim()) {
      return NextResponse.json({ mappingFailed: true, reason: 'empty_questionnaire' }, { status: 200 })
    }

    const columnHeaders: string[] = session.column_headers
    const sampleRows: any[][] = Array.isArray(session.raw_data) ? session.raw_data.slice(0, 5) : []

    const prompt = `You are a research methodology assistant mapping a survey questionnaire to a raw data spreadsheet's columns.

SPREADSHEET COLUMN HEADERS (in order):
${JSON.stringify(columnHeaders)}

SAMPLE DATA ROWS (first 5, same column order, to see the raw coded values actually used):
${JSON.stringify(sampleRows)}

QUESTIONNAIRE TEXT (extracted from the uploaded document):
"""
${questionnaireText.slice(0, 15000)}
"""

TASK:
For each spreadsheet column header that corresponds to a questionnaire item (a demographic
field or a survey question), determine:
1. The full question text as written in the questionnaire.
2. A label for each distinct raw coded value seen in the sample rows for that column
   (e.g. if the column contains 1 and 2, and the questionnaire shows "1 = Male, 2 = Female",
   map "1" -> "Male", "2" -> "Female"). Use the exact raw value (as a string) as the key.
3. Whether the item appears to be reverse-worded (i.e. negatively phrased relative to the
   construct it measures, such that a high raw score means a low level of the construct).
   Set "reverseWorded": true only if you are confident; otherwise false.
4. Whether this item is a demographic / respondent-profile question (e.g. age, gender,
    education, income, occupation, location, marital status) as opposed to a construct or
    survey item measuring an attitude, behavior, or belief. Set "role" to exactly
    "Demographic" or "Construct".

Only include columns you can confidently match to a questionnaire item. Skip columns you
cannot match (e.g. auto-generated IDs, timestamps) — do not guess.

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "mappings": {
    "<column_header>": {
      "questionText": "<full question text>",
      "valueLabels": { "<raw value as string>": "<label>", ... },
      "reverseWorded": false,
        "role": "Demographic"
    }
  }
}`

    let chainResult
    try {
      chainResult = await callQuestionnaireMapChain(prompt)
    } catch (chainErr: any) {
      console.error('Questionnaire mapping chain failed on both models:', chainErr)
      return NextResponse.json({ mappingFailed: true, reason: 'ai_unavailable' }, { status: 200 })
    }

    let parsed: any
    try {
      const cleaned = chainResult.content.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (parseErr: any) {
      console.error('Failed to parse questionnaire mapping JSON:', parseErr, chainResult.content)
      return NextResponse.json({ mappingFailed: true, reason: 'parse_failed' }, { status: 200 })
    }

    if (!parsed || typeof parsed.mappings !== 'object') {
      return NextResponse.json({ mappingFailed: true, reason: 'invalid_shape' }, { status: 200 })
    }

    const { error: updateError } = await supabase
      .from('quantitative_analysis_sessions')
      .update({
        questionnaire_mapping: parsed.mappings,
        questionnaire_mapping_confirmed: false,
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to save questionnaire mapping:', updateError)
      return NextResponse.json({ error: 'Failed to save mapping.' }, { status: 500 })
    }

    return NextResponse.json({
      mappings: parsed.mappings,
      providerUsed: chainResult.providerUsed,
    })
  } catch (err: any) {
    console.error('Unexpected error in map-questionnaire route:', err)
    return NextResponse.json({ error: err.message || 'Mapping failed.' }, { status: 500 })
  }
}
