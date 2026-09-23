import { callQuantInterpretChain } from '@/lib/openrouter'

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


const CITATION_STYLE_WRITING_RULES: Record<string, string> = {
  APA7: "Report statistics in APA7 style: report statistical symbols in plain text with no italics and no asterisks, as e.g. t(28) = 2.45, p = .019. Use two decimal places for most statistics and three for p-values below .001 (report as p < .001).",
  APA6: "Report statistics in APA6 style: report statistical symbols in plain text with no italics and no asterisks, as e.g. t(28) = 2.45, p = .019. Use two decimal places for most statistics.",
  Vancouver: "Report statistics in Vancouver/biomedical style: do not italicize symbols, use plain text (e.g. t=2.45, P=.019), and capitalize P for p-values.",
  AMA: "Report statistics in AMA style: do not italicize symbols, use plain text (e.g. t=2.45, P=.019), and capitalize P for p-values.",
  IEEE: "Report statistics in a compact, technical, IEEE-appropriate style: minimal prose, values reported plainly and concisely without italics.",
  Chicago17: "Report statistics in Chicago-style prose: plain, non-italicized statistical notation embedded naturally within full sentences.",
  Turabian9: "Report statistics in Turabian-style prose (same conventions as Chicago): plain, non-italicized statistical notation embedded naturally within full sentences.",
  Harvard: "Report statistics in Harvard-style prose: plain, non-italicized statistical notation, straightforward academic tone common in business and social science reporting.",
  MLA9: "MLA does not have an established convention for reporting quantitative statistics. Write the interpretation in plain narrative prose, minimizing statistical jargon and symbol-heavy notation, favoring accessible descriptive language over formal statistical notation.",
  OSCOLA: "OSCOLA does not have an established convention for reporting quantitative statistics. Write the interpretation in plain, minimal-notation prose suitable for a legal-adjacent academic audience.",
};

function getCitationWritingRule(citationStyle?: string): string {
  if (!citationStyle || !CITATION_STYLE_WRITING_RULES[citationStyle]) {
    return CITATION_STYLE_WRITING_RULES.APA7;
  }
  return CITATION_STYLE_WRITING_RULES[citationStyle];
}

export async function runQuantInterpretation(session: any, citationStyle?: string): Promise<{ interpretation: string; discussion: string; tableInterpretations: Record<string, string> }> {
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
- Logistic Regression (B, S.E., Wald statistic, df, p-value, Exp(B)/odds ratio per predictor)
- ANOVA/Model Fit (F-statistic, df, significance)
- Two-Way ANOVA (F-statistic and p-value for each main effect and the interaction, df for each)
- Independent-Samples t-test (t value, df, p-value, mean difference, group means)
- Paired-Samples t-test (t value, df, p-value, mean difference between the two measurements)
- Mann-Whitney U Test (U statistic, Z, p-value, mean ranks per group)
- Wilcoxon Signed-Rank Test (Z, p-value, sum of ranks)
- Kruskal-Wallis Test (H statistic, df, p-value, mean ranks per group)
- Chi-Square Test of Independence (chi-square value, df, p-value)
- Mediation Analysis (path a: predictor to mediator coefficient/p-value, path b: mediator to outcome coefficient/p-value, indirect effect, Sobel z or bootstrap CI if available)
- Moderation Analysis (main effect B/SE/t/p for predictor and moderator, interaction term B/SE/t/p, R-squared change)

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
      throw new Error(err.message || 'Step 3a (statistical breakdown) failed')
    }

    let step3a: any
    try {
      step3a = JSON.parse(stripFences(step3aRaw))
    } catch (err: any) {
      throw new Error('Step 3a returned invalid JSON: ' + step3aRaw.slice(0, 300))
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
For each table in Step 3a's result_tables, write a concise, excellent-quality interpretation of MAXIMUM 6 lines. Every contextual finding must be phrased in terms of the actual questionnaire scale labels the respondents saw (e.g. "most respondents Agree", "the mean falls in the Neutral (Undecided) range") rather than a bare restatement of the coefficient or p-value. Then, for each hypothesis, state explicitly whether it is Supported or Rejected.

CITATION STYLE REQUIREMENT:\n${getCitationWritingRule(citationStyle)}\n\nSTRICT TONE & GRAMMAR CONSTRAINTS:
1. Write in clear, simple, direct English.
2. Use STRICT THIRD-PERSON PERSPECTIVE. NEVER use 'I', 'we', or 'our'.
3. Link every statistical interpretation directly to its hypothesis.

GUARDRAILS (do not skip):
4. Do not treat statistical significance alone as the full picture. Where significant but effect size is small, or p-value is borderline (0.045-0.050), explicitly note this nuance rather than an unqualified Supported/Rejected framing.
5. Only interpret tables actually provided by Step 3a. Never invent a result not present in step3aResultTables.
6. If step3aResultTables is missing/empty for a hypothesis, return "insufficient_data" naming which hypothesis could not be tested and why.
7. Every table gets its OWN distinct interpretation paragraph \u2014 never combine multiple tables into one shared interpretation.
    8. Keep every table's interpretation to a MAXIMUM of 6 lines. Be concise, precise, and academically excellent — no filler, no restating the raw numbers already shown in the table, no repeating the hypothesis wording verbatim.

Respond ONLY with valid JSON, no preamble, no markdown fences:

{
"quantitative_hypothesis_findings": {
"insufficient_data": "string or null",
"table_interpretations": [
{
"table_title": "string, must match a table_title from Step 3a",
"interpretation": "string, MAXIMUM 6 lines, concise and academically excellent, mapped to questionnaire scale labels"
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
      throw new Error(err.message || 'Step 3b (hypothesis findings) failed')
    }

    let step3b: any
    try {
      step3b = JSON.parse(stripFences(step3bRaw))
    } catch (err: any) {
      throw new Error('Step 3b returned invalid JSON: ' + step3bRaw.slice(0, 300))
    }

    const findings = step3b?.quantitative_hypothesis_findings || {}

  let interpretation = '';
  const tableInterpretations: Record<string, string> = {};
  for (const t of resultTables) {
    let block = `${t.table_title}\n${t.why_appropriate ? 'Rationale: ' + t.why_appropriate + '\n' : ''}`;
    const match = (findings.table_interpretations || []).find((ti: any) => ti.table_title === t.table_title);
    if (match) block += `${match.interpretation}\n\n`;
    interpretation += block;
    tableInterpretations[t.table_title] = block;
  }

    let discussion = ''
    for (const h of (findings.hypothesis_testing || [])) {
      discussion += `${h.statement} (${h.decision}): ${h.academic_interpretation}${h.effect_size_note ? ' ' + h.effect_size_note : ''}\n\n`
    }


  return { interpretation, discussion, tableInterpretations };
}

// ===== BATCHED INTERPRETATION PIPELINE (added to fit Vercel Hobby 60s limit) =====

export const ANALYSIS_KEY_BATCH_GROUPS: string[][] = [
  ['descriptives', 'frequencyTables', 'itemDescriptives'],
  ['correlation', 'regression', 'logistic'],
  ['ttest', 'paired', 'mannwhitney', 'wilcoxon'],
  ['anova', 'twowayanova', 'kruskalwallis'],
  ['chisquare', 'moderation', 'mediation'],
]

export function getPresentAnalysisBatches(results: any): string[][] {
  const batches: string[][] = []
  for (const group of ANALYSIS_KEY_BATCH_GROUPS) {
    const present = group.filter((k) => results && results[k] !== undefined && results[k] !== null)
    if (present.length > 0) batches.push(present)
  }
  return batches
}

export async function runStep3aBatch(resultsSlice: any, citationStyle?: string): Promise<any[]> {
  const prompt3aBatch = `You are analyzing quantitative statistical results (SPSS outputs) for an undergraduate research submission under NUC guidelines. This is Step 3a of the chunked pipeline, run on ONE BATCH of the full results at a time.

INPUT DATA (this batch only):
- SPSS Statistical Results/Tables: ${JSON.stringify(resultsSlice)}

TASK:
Extract and structure ONLY the mathematical parameters present in this batch (correlation, regression, logistic regression, ANOVA/model fit, two-way ANOVA, t-tests, Mann-Whitney, Wilcoxon, Kruskal-Wallis, Chi-Square, mediation, moderation - whichever apply). For each test present, also state WHY that specific test was appropriate for this research design, based only on the actual IV/DV/grouping-variable roles and data types already established for this session. Reproduce the key result table for each test as structured data.

MANDATORY EXACT TABLE TITLES - use these exact strings for table_title, do not invent your own wording, so titles match the results page exactly:
- Correlation (Pearson): "Pearson Correlations Among Study Variables (Default)"
- Correlation (Spearman): "Spearman's Rank Correlations Among Study Variables (Supplementary)"
- Regression: "Variables Entered/Removed", "Model Summary", "ANOVA", "Coefficients"
- t-test: "Group Statistics", "Independent Samples Test"
- Paired t-test: "Paired Samples Test", "Paired Samples Statistics"
- Mann-Whitney: "Mann-Whitney U Test Ranks", "Mann-Whitney U Test Statistics"
- Wilcoxon: "Wilcoxon Signed-Rank Test"
- ANOVA (one-way): "Descriptive Statistics for {outcome} by {group}", "One-Way ANOVA: {outcome} by {group}", "Post Hoc Tests - Tukey HSD Multiple Comparisons"
- Kruskal-Wallis: "Kruskal-Wallis Test Ranks", "Kruskal-Wallis Test Statistics"
- Two-way ANOVA: "Tests of Between-Subjects Effects"
- Chi-Square: "{row} x {col} Crosstabulation", "Chi-Square Tests"
- Moderation: "Moderation Model Summary", "Moderation Coefficients"
- Mediation: "Mediation Path Coefficients", "Sobel Test for Indirect Effect"
- Logistic Regression: "Model Summary", "Variables in the Equation"

Use the actual outcome/group/row/col variable names from the input data in place of {outcome}, {group}, {row}, {col}.

GUARDRAILS (do not skip):
1. Do NOT decide Supported/Rejected, and do NOT reference questionnaire scale labels - that belongs to Step 3b, never here. The test-appropriateness justification is the one exception.
2. Only structure tests actually present in this batch's results. Never invent a test, value, or table not provided.
3. If the results in this batch are missing/unreadable/insufficient, return "insufficient_data" naming which test could not be structured and why.
4. Every table title appears ABOVE the table, plain text, NEVER italicized.
5. Report every source number exactly as given, no rounding beyond the source, no rephrasing into words.

Respond ONLY with valid JSON, no preamble, no markdown fences:
{
  "quantitative_statistical_breakdown": {
    "insufficient_data": "string or null",
    "result_tables": [
      { "table_title": "string, plain text, no italics", "test_type": "string", "why_appropriate": "string, grounded only in this session's IV/DV/grouping-variable roles and data types", "columns": ["string"], "rows": [["string"]] }
    ]
  }
}`

  let raw: string
  try {
    const result = await callQuantInterpretChain(prompt3aBatch)
    raw = result.content
  } catch (err: any) {
    throw new Error(err.message || 'Step 3a batch failed')
  }

  let parsed: any
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch (err: any) {
    throw new Error('Step 3a batch returned invalid JSON: ' + raw.slice(0, 300))
  }

  return parsed?.quantitative_statistical_breakdown?.result_tables || []
}

export async function runStep3bBatch(
  tablesBatch: any[],
  framework: any,
  scaleInfo: Record<string, any>,
  reliabilityInfo: any,
  responseRateInfo: any,
  citationStyle?: string
): Promise<{ tableInterpretations: Record<string, string>; hypothesisTesting: any[] }> {
  const prompt3bBatch = `You are producing hypothesis decisions and contextual findings for an undergraduate research submission under NUC guidelines. This is one batch of a multi-batch run - it receives a SLICE of the full set of result tables. Only decide a hypothesis if its full evidence is contained in THIS batch's tables; otherwise leave it out (a later batch with the right table will cover it).

INPUT DATA:
- Result Tables (this batch only): ${JSON.stringify(tablesBatch)}
- Research Questions: ${JSON.stringify(framework?.researchQuestions || [])}
- Research Hypotheses: ${JSON.stringify(framework?.hypotheses || [])}
- Questionnaire Scale Labels (per construct): ${JSON.stringify(scaleInfo)}
- Reliability Info (if provided): ${JSON.stringify(reliabilityInfo)}
- Response Rate Info (if provided): ${JSON.stringify(responseRateInfo)}

TASK:
For each table in this batch, write a concise interpretation of MAXIMUM 6 lines, phrased using the actual questionnaire scale labels (e.g. "most respondents Agree"), not a bare restatement of the coefficient. For each hypothesis fully covered by this batch, state explicitly Supported or Rejected.

CITATION STYLE REQUIREMENT:\n${getCitationWritingRule(citationStyle)}\n\nSTRICT TONE & GRAMMAR CONSTRAINTS:
1. Write in clear, simple, direct English.
2. Use STRICT THIRD-PERSON PERSPECTIVE. NEVER use 'I', 'we', or 'our'.
3. Link every statistical interpretation directly to its hypothesis.

GUARDRAILS (do not skip):
4. Do not treat significance alone as the full picture. Where significant but effect size is small, or p is borderline (0.045-0.050), note this nuance rather than an unqualified framing.
5. Only interpret tables actually provided in this batch. Never invent a result not present.
6. If tablesBatch is empty, return "insufficient_data" naming which hypothesis could not be tested and why.
7. Every table gets its OWN distinct interpretation - never combine tables.
8. Keep every interpretation to a MAXIMUM of 6 lines. Be concise, precise, and academically excellent - no filler, no restating the raw numbers, no repeating the hypothesis wording verbatim.

Respond ONLY with valid JSON, no preamble, no markdown fences:
{
  "quantitative_hypothesis_findings": {
    "insufficient_data": "string or null",
    "table_interpretations": [
      { "table_title": "string, must match a table_title from this batch", "interpretation": "string, MAXIMUM 6 lines" }
    ],
    "hypothesis_testing": [
      { "hypothesis_id": 1, "statement": "string", "statistical_test_used": "string", "key_metric_value": "string", "effect_size_note": "string", "decision": "string, Supported or Rejected", "academic_interpretation": "string, 3-4 sentences" }
    ]
  }
}`

  let raw: string
  try {
    const result = await callQuantInterpretChain(prompt3bBatch)
    raw = result.content
  } catch (err: any) {
    throw new Error(err.message || 'Step 3b batch failed')
  }

  let parsed: any
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch (err: any) {
    throw new Error('Step 3b batch returned invalid JSON: ' + raw.slice(0, 300))
  }

  const findings = parsed?.quantitative_hypothesis_findings || {}
  const tableInterpretations: Record<string, string> = {}
  ;(findings.table_interpretations || []).forEach((ti: any) => {
    if (ti?.table_title) tableInterpretations[ti.table_title] = ti.interpretation || ''
  })

  return { tableInterpretations, hypothesisTesting: findings.hypothesis_testing || [] }
}

export function finalizeInterpretation(
  resultTables: any[],
  tableInterpretations: Record<string, string>,
  hypothesisTesting: any[]
): { interpretation: string; discussion: string; tableInterpretations: Record<string, string> } {
  let interpretation = ''
  for (const t of resultTables) {
    let block = `${t.table_title}\n${t.why_appropriate ? 'Rationale: ' + t.why_appropriate + '\n' : ''}`
    const found = tableInterpretations[t.table_title]
    if (found) block += `${found}\n\n`
    interpretation += block
  }

  let discussion = ''
  for (const h of hypothesisTesting) {
    discussion += `${h.statement} (${h.decision}): ${h.academic_interpretation}${h.effect_size_note ? ' ' + h.effect_size_note : ''}\n\n`
  }

  return { interpretation, discussion, tableInterpretations }
}
