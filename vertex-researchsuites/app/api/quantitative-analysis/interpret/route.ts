export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

import {
  getPresentAnalysisBatches,
  runStep3aBatch,
  runStep3bBatch,
  finalizeInterpretation,
} from '@/lib/quantInterpret'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, phase, batchIndex, resultTables, tableInterpretations, hypothesisTesting } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }
    if (!phase) {
      return NextResponse.json({ error: 'Missing phase' }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('quantitative_analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session || !session.results) {
      return NextResponse.json({ error: 'Results not found. Run calculation first.' }, { status: 404 })
    }

    const citationStyle = session.research_framework?.apaVersion || 'APA7'

    if (phase === 'get_batch_plan') {
      const batches = getPresentAnalysisBatches(session.results)
      return NextResponse.json({ totalBatches: batches.length })
    }

    if (phase === '3a') {
      const batches = getPresentAnalysisBatches(session.results)
      const idx = typeof batchIndex === 'number' ? batchIndex : 0
      if (idx < 0 || idx >= batches.length) {
        return NextResponse.json({ error: 'Invalid batchIndex for phase 3a' }, { status: 400 })
      }
      const keysThisBatch = batches[idx]
      const resultsSlice: any = {}
      keysThisBatch.forEach((k) => { resultsSlice[k] = session.results[k] })

      let tables: any[]
      try {
        tables = await runStep3aBatch(resultsSlice, citationStyle)
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Step 3a batch failed' }, { status: 500 })
      }

      return NextResponse.json({ tables, totalBatches: batches.length, batchIndex: idx })
    }

    if (phase === '3b') {
      if (!Array.isArray(resultTables)) {
        return NextResponse.json({ error: 'Missing resultTables for phase 3b' }, { status: 400 })
      }
      const idx = typeof batchIndex === 'number' ? batchIndex : 0
      const BATCH_SIZE = 4
      const start = idx * BATCH_SIZE
      const tablesBatch = resultTables.slice(start, start + BATCH_SIZE)
      const totalBatches = Math.ceil(resultTables.length / BATCH_SIZE)

      if (tablesBatch.length === 0) {
        return NextResponse.json({ error: 'Invalid batchIndex for phase 3b' }, { status: 400 })
      }

      const framework = session.research_framework || {}
      const scaleInfo = session.scale_info || {}
      const responseRateInfo = session.response_rate_info || {}
      const reliabilityInfo = session.reliability_info || {}

      let batchResult
      try {
        batchResult = await runStep3bBatch(tablesBatch, framework, scaleInfo, reliabilityInfo, responseRateInfo, citationStyle)
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Step 3b batch failed' }, { status: 500 })
      }

      return NextResponse.json({ ...batchResult, totalBatches, batchIndex: idx })
    }

    if (phase === 'finalize') {
      if (!Array.isArray(resultTables) || !tableInterpretations || !Array.isArray(hypothesisTesting)) {
        return NextResponse.json({ error: 'Missing data for finalize phase' }, { status: 400 })
      }

      const final = finalizeInterpretation(resultTables, tableInterpretations, hypothesisTesting)

      await supabase
        .from('quantitative_analysis_sessions')
        .update({ interpretation: final.interpretation, discussion: final.discussion })
        .eq('id', sessionId)

      return NextResponse.json(final)
    }

    return NextResponse.json({ error: 'Unknown phase: ' + phase }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Interpretation failed' }, { status: 500 })
  }
}
