export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQuantInterpretChain } from '@/lib/openrouter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function deriveScaleLabels(constructs: any[]): Record<string, any> {
  const scaleInfo: Record<string, any> = {}

  const known: Record<string, string[]> = {
    "5-point: Strongly Disagree \u2194 Strongly Agree": ["Strongly Disagree", "Disagree", "Neutral (Undecided)", "Agree", "Strongly Agree"],
    "5-point: Never \u2194 Always": ["Never", "Rarely", "Sometimes", "Often", "Always"],
    "5-point: Very Dissatisfied \u2194 Very Satisfied": ["Very Dissatisfied", "Dissatisfied", "Neutral (Undecided)", "Satisfied", "Very Satisfied"],
    "4-point: Strongly Disagree \u2194 Strongly Agree (no neutral)": ["Strongly Disagree", "Disagree", "Agree", "Strongly Agree"],
    "7-point: Strongly Disagree \u2194 Strongly Agree": ["Strongly Disagree", "Somewhat Disagree", "Neutral (Undecided)", "Somewhat Agree", "Agree", "Strongly Agree"],
    "Yes / No (binary)": ["Yes", "No"],
  }

  for (const c of constructs) {
    if (c.role === "Demographic") continue
    const labels = known[c.presetLabel]
    if (!labels) {
      scaleInfo[c.name] = "scale meaning not provided"
      continue
    }
    const ordered = c.scaleReversed ? [...labels].reverse() : labels
    const mapping: Record<string, string> = {}
    ordered.forEach((label, i) => {
      mapping[String(c.scaleMin + i)] = label
    })
    scaleInfo[c.name] = mapping
  }

  return scaleInfo
}

function stripFences(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim()
}

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
      return NextResponse.json({ error: 'Results not found. Run calculation first.' }, { status: 404 })
    }

    if (!session.response_rate_info) {
      return NextResponse.json({ error: 'Response rate information is missing.' }, { status: 400 })
    }
    if (!session.reliability_info) {
      return NextResponse.json({ error: 'Reliability information is missing.' }, { status: 400 })
    }

    const framework = session.research_framework || {}
    const scaleInfo = deriveScaleLabels(session.constructs || [])
    const responseRateInfo = session.response_rate_info || {}
    const reliabilityInfo = session.reliability_info || {}
    const results = session.results
    const apaVersion = framework.apaVersion || '7th edition'

    const prompt3a = `You are analyzing quantitative statistical results (SPSS outputs) for an undergraduate research submission under NUC guidelines. This is Step 3a of the chunked pipeline \u2014 primary statistical breakdown and mathematical parameters only. Step 3b (a separate, dedicated call) adds hypothesis decisions and scale-label context on top of this output.

INPUT DATA:
- SPSS Statistical Results/Tables: "${JSON.stringify(results)}"
- Research Hypotheses (for table labeling only, not for decisions): ${JSON.stringify(framework.hypotheses || [])}

TASK:
Extract and structure ONLY the mathematical parameters. Explicitly identify and structure whichever of the following are present:
- Pearson/Spearman Correlation (r, p-value, strength and direction)
- Linear/Multiple Regression (R, R-squared, Adjusted R-squared, Std. Error, Beta coefficients, t-values, p-values per predictor)
- ANOVA/Model Fit (F-statistic, df, significance)
- Chi-Square Test of Independence (chi-square value, df, p-value)
- t-test / ANOVA (t or F value, df, p-value, mean differences)

For each test present, also state WHY that specific test was appropriate for this research design, based only on the actual IV/DV/grouping-variable roles and data types already established for this session \u2014 do not invent methodological reasoning beyond what those roles support.

Reproduce the key result table for each test as structured data.

GUARDRAILS (do not skip):
1. Do NOT decide Supported/Rejected, do NOT write plain-language interpretation of significance, and do NOT reference questionnaire scale labels \u2014 all of that belongs to Step 3b, never here. The test-appropriateness justification is the one exception \u2014 it explains methodology choice, not results.
2. Only structure tests actually present in the results. Never invent a test, value, or table not provided.
3. If the results are missing/unreadable/insufficient, return "insufficient_data" naming which test could not be structured and why.
4. Every table title appears ABOVE the table, plain text, NEVER italicized.
5. Report every number exactly as given \u2014 no rounding beyond the source, no rephrasing into words.

Respond ONLY with valid JSON, no preamble, no markdown fences:

{
"quantitative_statistical_breakdown": {
"insufficient_data": "string or null",
"result_tables": [
{
"table_title": "string, plain text, no italics",
"test_type": "string",
"why_appropriate": "string, grounded only in this session's IV/DV/grouping-variable roles and data types",
"columns": ["string"],
"rows": [["string"]]
}
]
}
}`

    let step3aRaw: string
    try {
      const result3a = await callQuantInterpretChain(prompt3a)
      step3aRaw = result3a.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Step 3a (statistical breakdown) failed' }, { status: 500 })
    }

    let step3a: any
    try {
      step3a = JSON.parse(stripFences(step3aRaw))
    } catch (err: any) {
      return NextResponse.json({ error: 'Step 3a returned invalid JSON: ' + step3aRaw.slice(0, 300) }, { status: 500 })
    }

    const resultTables = step3a?.quantitative_statistical_breakdown?.result_tables || []

    const prompt3b = `You are producing hypothesis decisions and contextual findings for an undergraduate research submission under NUC guidelines. This is Step 3b of the chunked pipeline \u2014 it receives Step 3a's result_tables as input and adds the interpretive layer that Step 3a deliberately excluded.

INPUT DATA:
- Step 3a Result Tables: ${JSON.stringify(resultTables)}
- Research Questions: ${JSON.stringify(framework.researchQuestions || [])}
- Research Hypotheses: ${JSON.stringify(framework.hypotheses || [])}
- Questionnaire Scale Labels (per construct): ${JSON.stringify(scaleInfo)}
- Reliability Info (if provided): ${JSON.stringify(reliabilityInfo)}
- Response Rate Info (if provided): ${JSON.stringify(responseRateInfo)}

TASK:
For each table in Step 3a's result_tables, write a distinct interpretation paragraph. Every contextual finding must be phrased in terms of the actual questionnaire scale labels the respondents saw (e.g. "most respondents Agree", "the mean falls in the Neutral (Undecided) range") rather than a bare restatement of the coefficient or p-value. Then, for each hypothesis, state explicitly whether it is Supported or Rejected.

STRICT TONE & GRAMMAR CONSTRAINTS:
1. Write in clear, simple, direct English.
2. Use STRICT THIRD-PERSON PERSPECTIVE. NEVER use 'I', 'we', or 'our'.
3. Link every statistical interpretation directly to its hypothesis.

GUARDRAILS (do not skip):
4. Do not treat statistical significance alone as the full picture. Where significant but effect size is small, or p-value is borderline (0.045-0.050), explicitly note this nuance rather than an unqualified Supported/Rejected framing.
5. Only interpret tables actually provided by Step 3a. Never invent a result not present in step3aResultTables.
6. If step3aResultTables is missing/empty for a hypothesis, return "insufficient_data" naming which hypothesis could not be tested and why.
7. Every table gets its OWN distinct interpretation paragraph \u2014 never combine multiple tables into one shared interpretation.

Respond ONLY with valid JSON, no preamble, no markdown fences:

{
"quantitative_hypothesis_findings": {
"insufficient_data": "string or null",
"table_interpretations": [
{
"table_title": "string, must match a table_title from Step 3a",
"interpretation": "string, mapped to questionnaire scale labels"
}
],
"hypothesis_testing": [
{
"hypothesis_id": 1,
"statement": "string",
"statistical_test_used": "string",
"key_metric_value": "string",
"effect_size_note": "string",
"decision": "string, Supported or Rejected",
"academic_interpretation": "string, 3-4 sentences"
}
]
}
}`

    let step3bRaw: string
    try {
      const result3b = await callQuantInterpretChain(prompt3b)
      step3bRaw = result3b.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Step 3b (hypothesis findings) failed' }, { status: 500 })
    }

    let step3b: any
    try {
      step3b = JSON.parse(stripFences(step3bRaw))
    } catch (err: any) {
      return NextResponse.json({ error: 'Step 3b returned invalid JSON: ' + step3bRaw.slice(0, 300) }, { status: 500 })
    }

    const findings = step3b?.quantitative_hypothesis_findings || {}

    let interpretation = ''
    for (const t of resultTables) {
      interpretation += `${t.table_title}\n${t.why_appropriate ? 'Rationale: ' + t.why_appropriate + '\n' : ''}`
      const match = (findings.table_interpretations || []).find((ti: any) => ti.table_title === t.table_title)
      if (match) interpretation += `${match.interpretation}\n\n`
    }

    let discussion = ''
    for (const h of (findings.hypothesis_testing || [])) {
      discussion += `${h.statement} (${h.decision}): ${h.academic_interpretation}${h.effect_size_note ? ' ' + h.effect_size_note : ''}\n\n`
    }

    await supabase
      .from('quantitative_analysis_sessions')
      .update({ interpretation, discussion })
      .eq('id', sessionId)

    return NextResponse.json({ interpretation, discussion })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Interpretation failed' }, { status: 500 })
  }
}
