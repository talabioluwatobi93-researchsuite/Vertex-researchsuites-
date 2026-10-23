import { requireSessionAccess } from '@/lib/sessionAuth'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { reconcileHypotheses } from '@/lib/quantInterpret'
import { searchVerifiedRefs, formatReference } from '@/lib/citationVerify'

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
    const own1 = await requireSessionAccess(req, sessionId, 'quantitative_analysis_sessions')
    if (!own1.ok) return NextResponse.json({ error: own1.error }, { status: own1.status })
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
      keysThisBatch.forEach((k: string) => {
        // PHASE8F3: batch 'ttest#2' etc. = that run's data, given to the generator under the normal key
        if (/^(ttest|mannwhitney|anova|kruskalwallis)#/.test(k)) {
          const base8 = k.split('#')[0]
          const rn8 = Number(k.split('#')[1])
          const found8 = ((session.results && session.results[base8 + '_runs']) || []).find((x: any) => x.run === rn8)
          if (found8) resultsSlice[base8] = found8
          return
        }
        if (k.startsWith('moderation#')) {
          const rn = Number(k.split('#')[1])
          const found = ((session.results && session.results.moderation_runs) || []).find((r: any) => r.run === rn)
          if (found) resultsSlice['moderation'] = found
        } else {
          resultsSlice[k] = session.results[k]
        }
      }) // PHASE7E2

      let tables: any[]
      try {
        tables = await runStep3aBatch(resultsSlice, citationStyle)
      const runKey = keysThisBatch.find((k: string) => k.indexOf('#') > 0)
      if (runKey) {
        const rn = runKey.split('#')[1]
        ;(tables || []).forEach((t: any) => {
          if (t && typeof t.table_title === 'string') t.table_title = t.table_title + ' (Run ' + rn + ')'
          else console.warn('[interpret] run table without a title, could not label it with its run')
        })
      }
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

      const final = finalizeInterpretation(resultTables, tableInterpretations, await reconcileHypotheses(hypothesisTesting, resultTables, session.research_framework, tableInterpretations))

      try {
        const dtxt = String(final.discussion || '')
        const nS = (dtxt.match(/\(Supported\):/g) || []).length
        const nR = (dtxt.match(/\(Rejected\):/g) || []).length
        const nI = (dtxt.match(/\(Insufficient[^)]*\):/g) || []).length
        const nT = nS + nR + nI
        if (nT > 0) {
          final.discussion = String(final.discussion || '') + '\nSummary of Findings\nOf ' + nT + ' hypotheses tested: ' + nS + ' supported, ' + nR + ' rejected, ' + nI + ' with insufficient data.\n'
        }
      } catch (e) {
        console.error('Summary of findings failed:', e)
      }
      try {
        const fw: any = session.research_framework || {}
        const topicTxt = String(fw.topic || '')
        if (topicTxt) {
          const sty = /6/.test(String(fw.apaVersion || '')) ? 'APA6' : 'APA7'
          const rs = await searchVerifiedRefs(topicTxt, 6)
          const rl: any[] = rs.refs || []
          let lit = '\nRelated literature (verified sources, suggested reading)\n'
          if (rl.length) {
            lit += rl.length + ' verified source(s) found:\n' + rl.map((x: any) => '- ' + formatReference(x, sty)).join('\n') + '\n'
          } else {
            lit += 'No verified sources were found for this topic.\n'
          }
          final.discussion = String(final.discussion || '') + lit
        }
      } catch (e) {
        console.error('Related literature failed:', e)
      }

      await supabase
        .from('quantitative_analysis_sessions')
        .update({ interpretation: final.interpretation, discussion: final.discussion, table_interpretations: final.tableInterpretations || {} })
        .eq('id', sessionId)

      return NextResponse.json(final)
    }

    return NextResponse.json({ error: 'Unknown phase: ' + phase }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Interpretation failed' }, { status: 500 })
  }
}
