export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callPilotStudyChain } from '@/lib/openrouter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function r3(n: number): number { return Math.round(n * 1000) / 1000 }
function r2(n: number): number { return Math.round(n * 100) / 100 }

function variance(arr: number[]): number {
  const n = arr.length
  if (n < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / n
  const sumSq = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0)
  return sumSq / (n - 1)
}

function cronbachAlpha(matrix: number[][]): { k: number; n: number; alpha: number } {
  const n = matrix.length
  const k = matrix[0]?.length || 0
  if (n < 2 || k < 2) return { k, n, alpha: 0 }
  const itemVariances: number[] = []
  for (let j = 0; j < k; j++) {
    const col = matrix.map((row) => row[j])
    itemVariances.push(variance(col))
  }
  const totalScores = matrix.map((row) => row.reduce((a, b) => a + b, 0))
  const totalVariance = variance(totalScores)
  const sumItemVar = itemVariances.reduce((a, b) => a + b, 0)
  const alpha = totalVariance === 0 ? 0 : (k / (k - 1)) * (1 - sumItemVar / totalVariance)
  return { k, n, alpha: r3(alpha) }
}

function buildMatrix(rows: any[][], columnIndexes: number[], reverseIndexes: number[], scaleMin: number, scaleMax: number): number[][] {
  const matrix: number[][] = []
  for (const row of rows) {
    const values = columnIndexes.map((colIdx) => {
      const raw = row[colIdx]
      const num = typeof raw === 'number' ? raw : parseFloat(raw)
      return { colIdx, num }
    })
    const allValid = values.every((v) => !isNaN(v.num))
    if (!allValid) continue
    const scored = values.map((v) => {
      if (reverseIndexes.includes(v.colIdx)) {
        return scaleMin + scaleMax - v.num
      }
      return v.num
    })
    matrix.push(scored)
  }
  return matrix
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('pilot_study_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const rawData: any[][] = session.raw_data || []
    const constructs: any[] = session.constructs || []
    const cleaningConfig: any = session.cleaning_config || {}
    const scaleMin = cleaningConfig.scaleMin ?? 1
    const scaleMax = cleaningConfig.scaleMax ?? 5
    const missingConfig: any = cleaningConfig.missing_values || {}
    const duplicateInfo: any = cleaningConfig.duplicates || { row_indexes: [], action: 'excluded' }
    const straightLining: any = cleaningConfig.straight_lining || { detected_row_indexes: [], action: 'excluded' }
    const citationStyle: string = session.citation_style || 'APA7'
    const includeDemographics = session.include_demographics !== false

    const scaleConstructs = constructs.filter((c: any) => c.role === 'Scale')
    const demoConstructs = constructs.filter((c: any) => c.role === 'Demographic')

    const excludedRowIndexes = new Set<number>()
    if (duplicateInfo.action === 'excluded') {
      ;(duplicateInfo.row_indexes || []).forEach((idx: number) => excludedRowIndexes.add(idx))
    }
    if (straightLining.action === 'excluded') {
      ;(straightLining.detected_row_indexes || []).forEach((idx: number) => excludedRowIndexes.add(idx))
    }

    const rowIsMissingForExcludeRow = (row: any[]): boolean => {
      for (const c of scaleConstructs) {
        const cfg = missingConfig[c.id]
        if (!cfg || cfg.strategy !== 'exclude_row') continue
        const cols: number[] = c.columnIndexes || []
        const hasMissing = cols.some((ci) => {
          const val = row[ci]
          return val === null || val === undefined || String(val).trim() === ''
        })
        if (hasMissing) return true
      }
      return false
    }

    const cleanedRows: any[][] = []
    rawData.forEach((row, idx) => {
      if (excludedRowIndexes.has(idx)) return
      if (rowIsMissingForExcludeRow(row)) return
      cleanedRows.push(row)
    })

    const constructResults: { name: string; k: number; n: number; alpha: number; error?: string }[] = []
    const allColumnIndexes: number[] = []
    const allReverseIndexes: number[] = []

    for (const construct of scaleConstructs) {
      const matrix = buildMatrix(cleanedRows, construct.columnIndexes, construct.reverseIndexes, scaleMin, scaleMax)
      allColumnIndexes.push(...construct.columnIndexes)
      allReverseIndexes.push(...construct.reverseIndexes)

      if (matrix.length < 2 || construct.columnIndexes.length < 2) {
        constructResults.push({ name: construct.name, k: construct.columnIndexes.length, n: matrix.length, alpha: 0, error: 'Not enough valid data to calculate reliability.' })
        continue
      }

      const result = cronbachAlpha(matrix)
      constructResults.push({ name: construct.name, ...result })
    }

    const combinedMatrix = buildMatrix(cleanedRows, allColumnIndexes, allReverseIndexes, scaleMin, scaleMax)
    let combinedResult: { k: number; n: number; alpha: number } | null = null
    if (combinedMatrix.length >= 2 && allColumnIndexes.length >= 2) {
      combinedResult = cronbachAlpha(combinedMatrix)
    }

    let demographics: { tables: any[] } | null = null
    if (includeDemographics && demoConstructs.length > 0) {
      const tables = demoConstructs.map((c: any) => {
        const col = (c.columnIndexes || [])[0]
        const counts: Record<string, number> = {}
        let validTotal = 0
        let missingCount = 0

        cleanedRows.forEach((row: any[]) => {
          const val = row[col]
          if (val === null || val === undefined || String(val).trim() === '') {
            missingCount++
            return
          }
          const key = String(val).trim()
          counts[key] = (counts[key] || 0) + 1
          validTotal++
        })

        const allTotal = validTotal + missingCount
        let cumulative = 0
        const rows = Object.entries(counts).map(([label, count]) => {
          const validPercent = validTotal > 0 ? (count / validTotal) * 100 : 0
          cumulative += validPercent
          return {
            label,
            frequency: count,
            percent: allTotal > 0 ? r2((count / allTotal) * 100) : 0,
            validPercent: r2(validPercent),
            cumulativePercent: r2(cumulative),
          }
        })

        return { name: c.name, nValid: validTotal, nMissing: missingCount, rows }
      })

      demographics = { tables }
    }

    const results = {
      constructs: constructResults,
      combined: combinedResult,
      demographics,
      sampleSize: cleanedRows.length,
      excludedRows: rawData.length - cleanedRows.length,
      citationStyle,
    }

    const reliabilitySummary = `${constructResults.map((c) =>
      `- ${c.name}: Cronbach's Alpha = ${c.alpha} (${c.k} items, ${c.n} valid respondents)`
    ).join('\n')}
${combinedResult ? `- Combined (all scale sections): Cronbach's Alpha = ${combinedResult.alpha} (${combinedResult.k} items, ${combinedResult.n} valid respondents)` : ''}`

    const demographicsSummary = demographics
      ? demographics.tables.map((t) =>
          `${t.name}: ${t.rows.map((r: any) => `${r.label} (n=${r.frequency}, ${r.validPercent}%)`).join(', ')}`
        ).join('\n')
      : ''

    const cronbachAlphaScores = constructResults
      .map((c) => `${c.name}: ${c.error ? 'N/A' : c.alpha}`)
      .join(', ')

    const scaleInfo = `${scaleMin} to ${scaleMax}`

    const questionnairesShared = session.questionnaires_shared ?? null
    const responsesReceived = session.responses_received ?? null

    const pilotStudyPrompt = `You are preparing a formal Pilot Study Reliability & Validity Report for a research project submission.

INPUT DATA:
- Sample Size (n): ${results.sampleSize}
- Cronbach's Alpha Scores per Construct: ${cronbachAlphaScores}
- Scale Context: ${scaleInfo}
- Questionnaires Shared / Responses Received (if provided): ${questionnairesShared ?? 'not provided'}, ${responsesReceived ?? 'not provided'}

TASK:
Analyze the internal consistency of the measurement instrument. Evaluate Cronbach's Alpha scores against the standard 0.70 reliability threshold, identify problematic items needing modification, and state the response rate if reliability input was provided.

STRICT TONE & GRAMMAR CONSTRAINTS:
1. Write in simple, clear, direct English.
2. Use STRICT THIRD-PERSON PERSPECTIVE. NEVER use 'I', 'we', or 'my'.
3. Present Cronbach's Alpha values to 3 decimal places (e.g. 0.842).

GUARDRAILS (do not skip):
4. Do not evaluate a construct with no alpha score provided. Only report on constructs actually present in the input.
5. If sampleSize or cronbachAlphaScores is missing/empty, return "insufficient_data" instead of generating a report.
6. Defense prep questions must scan the actual alpha values and sample size of THIS pilot study. Each question paired with a defense-grade answer.

Respond ONLY with valid JSON, no preamble, no markdown fences:

{
"pilot_study_report": {
"insufficient_data": "string or null",
"response_rate_summary": "string, if questionnairesShared/responsesReceived provided",
"reliability_overview": "string, 100-150 words",
"construct_evaluations": [
{
"construct_name": "string",
"alpha_score": "string, e.g. 0.842",
"status": "string, Reliable (Acceptable/Excellent) or Unreliable",
"action_required": "string"
}
],
"validity_discussion": "string, 100-150 words",
"defense_prep_questions": [
{
"question": "string, specific to this pilot study's actual data",
"answer": "string, detailed, defense-grade"
}
]
}
}`

    const interpretationPrompt = `You are explaining pilot study statistics to a student who is not a statistics expert, for their thesis pilot study chapter. Do not recalculate anything -- only interpret the numbers given below, which were computed with real statistical code.

RELIABILITY RESULTS:
${reliabilitySummary}

${demographics ? `DEMOGRAPHIC RESULTS:\n${demographicsSummary}\n` : ''}

Return ONLY a raw JSON object, no markdown fences, no preamble, in exactly this shape:
{
  "reliability": "4-6 sentence plain-English interpretation of the reliability results using standard thresholds (below 0.6 poor, 0.6-0.7 questionable, 0.7-0.8 acceptable, 0.8-0.9 good, above 0.9 excellent). Do not invent numbers not given above."${demographics ? `,\n  "demographics": "3-5 sentence plain-English interpretation of the demographic profile of respondents, describing the sample composition. Do not invent numbers not given above."` : ''}
}`

    let interpretations: any = {
      pilot_study_report: {
        insufficient_data: null,
        response_rate_summary: null,
        reliability_overview: 'Interpretation could not be generated at this time. Your numerical results above are still valid.',
        construct_evaluations: [],
        validity_discussion: '',
        defense_prep_questions: [],
      },
    }

    try {
      const { content: text } = await callPilotStudyChain(pilotStudyPrompt)
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      interpretations = parsed
    } catch (aiErr) {
      console.error('Pilot Study AI chain failed:', aiErr)
      // fall back to defaults set above
    }

    const resultsReadyAt = new Date().toISOString()

      const { error: saveError, data: savedRows } = await supabase
        .from('pilot_study_sessions')
        .update({
          results,
          interpretation: interpretations,
          status: 'completed',
          results_ready_at: resultsReadyAt,
          results_revealed: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()

      if (saveError || !savedRows || savedRows.length === 0) {
        console.error('Failed to save pilot study results:', saveError, 'rows affected:', savedRows?.length)
        return NextResponse.json({ error: 'Could not save your results. Please try again.' }, { status: 500 })
      }

    let promoCode: string | null = null
    try {
      await supabase
        .from('user_promo_codes')
        .update({ status: 'expired' })
        .eq('user_id', session.user_id)
        .eq('status', 'active')

      const generatedCode = 'PILOT' + Math.random().toString(36).substring(2, 8).toUpperCase()
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

      const { error: promoError, data: promoRow } = await supabase
        .from('user_promo_codes')
        .insert({
          user_id: session.user_id,
          code: generatedCode,
          status: 'active',
          discount_percent: 10,
          applies_to: 'quantitative_analysis',
          linked_pilot_result_id: sessionId,
          expires_at: expiresAt,
        })
        .select()
        .single()

      if (promoError) {
        console.error('Failed to generate promo code:', promoError)
      } else {
        promoCode = promoRow.code
      }
    } catch (promoErr) {
      console.error('Promo code generation failed:', promoErr)
    }

    return NextResponse.json({ results, interpretation: interpretations, results_ready_at: resultsReadyAt, promo_code: promoCode })
  } catch (err) {
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 })
  }
}
