import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function variance(values: number[]): number {
  const m = mean(values)
  const squaredDiffs = values.map((v) => (v - m) ** 2)
  return squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1)
}

function cronbachAlpha(itemMatrix: number[][]): { alpha: number; k: number; n: number } {
  const k = itemMatrix[0].length
  const n = itemMatrix.length

  const itemVariances: number[] = []
  for (let col = 0; col < k; col++) {
    const columnValues = itemMatrix.map((row) => row[col])
    itemVariances.push(variance(columnValues))
  }

  const totalScores = itemMatrix.map((row) => row.reduce((a, b) => a + b, 0))
  const totalVariance = variance(totalScores)

  const sumItemVariances = itemVariances.reduce((a, b) => a + b, 0)
  const alpha = (k / (k - 1)) * (1 - sumItemVariances / totalVariance)

  return { alpha: Math.round(alpha * 100) / 100, k, n }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const { data: session, error: fetchError } = await supabase
      .from('pilot_study_sessions')
      .select('raw_data, constructs, cleaning_config, results, interpretation, results_ready_at, results_revealed, status')
      .eq('id', sessionId)
      .single()

    if (sessionRow?.status === 'completed' && sessionRow?.results) {
      return NextResponse.json({ results: sessionRow.results, interpretation: sessionRow.interpretation, results_ready_at: sessionRow.results_ready_at })
    }

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const rawData: any[][] = session.raw_data
    const constructs: { id: string; name: string; columnIndexes: number[]; reverseIndexes: number[] }[] = session.constructs
    const scaleMin = session.cleaning_config?.scaleMin ?? 1
    const scaleMax = session.cleaning_config?.scaleMax ?? 5

    if (!constructs || constructs.length === 0) {
      return NextResponse.json({ error: 'No constructs found for this session' }, { status: 400 })
    }

    const buildMatrix = (columnIndexes: number[], reverseIndexes: number[]): number[][] => {
      const matrix: number[][] = []
      for (const row of rawData) {
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

    const constructResults: { name: string; k: number; n: number; alpha: number; error?: string }[] = []
    const allColumnIndexes: number[] = []
    const allReverseIndexes: number[] = []

    for (const construct of constructs) {
      const matrix = buildMatrix(construct.columnIndexes, construct.reverseIndexes)
      allColumnIndexes.push(...construct.columnIndexes)
      allReverseIndexes.push(...construct.reverseIndexes)

      if (matrix.length < 2 || construct.columnIndexes.length < 2) {
        constructResults.push({ name: construct.name, k: construct.columnIndexes.length, n: matrix.length, alpha: 0, error: 'Not enough valid data to calculate reliability.' })
        continue
      }

      const result = cronbachAlpha(matrix)
      constructResults.push({ name: construct.name, ...result })
    }

    const combinedMatrix = buildMatrix(allColumnIndexes, allReverseIndexes)
    let combinedResult: { k: number; n: number; alpha: number } | null = null
    if (combinedMatrix.length >= 2 && allColumnIndexes.length >= 2) {
      combinedResult = cronbachAlpha(combinedMatrix)
    }

    const results = { constructs: constructResults, combined: combinedResult }

    const interpretationPrompt = `You are explaining Cronbach's Alpha reliability results to a student who is not a statistics expert, for their pilot study chapter. Do not recalculate anything — only interpret the numbers given below, which were computed with real statistical code.

Results:
${constructResults.map((c) => `- ${c.name}: Cronbach's Alpha = ${c.alpha} (${c.k} items, ${c.n} valid respondents)`).join('\n')}
${combinedResult ? `- Combined (all sections): Cronbach's Alpha = ${combinedResult.alpha} (${combinedResult.k} items, ${combinedResult.n} valid respondents)` : ''}

Write a short, clear, plain-English interpretation (4-6 sentences) explaining what these alpha values mean for reliability, using standard thresholds (below 0.6 poor, 0.6-0.7 questionable, 0.7-0.8 acceptable, 0.8-0.9 good, above 0.9 excellent). Do not invent numbers not given above. Keep it suitable for inclusion in an academic pilot study writeup.`

    let interpretation = ''
    try {
      const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 500,
          messages: [{ role: 'user', content: interpretationPrompt }],
        }),
      })
      const aiData = await aiResponse.json()
      interpretation = aiData.content?.map((b: any) => b.text || '').join('\n') || ''
    } catch (aiErr) {
      interpretation = 'Interpretation could not be generated at this time. Your numerical results above are still valid.'
    }

    const resultsReadyAt = new Date().toISOString()

    await supabase
      .from('pilot_study_sessions')
      .update({
        results,
        interpretation,
        status: 'completed',
        results_ready_at: resultsReadyAt,
        results_revealed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    return NextResponse.json({ results, interpretation, results_ready_at: resultsReadyAt })
  } catch (err) {
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 })
  }
}
