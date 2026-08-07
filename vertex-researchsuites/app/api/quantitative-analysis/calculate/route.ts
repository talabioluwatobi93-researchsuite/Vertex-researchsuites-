import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mean, sd, pearson, olsRegression } from '@/lib/stats'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function r3(n: number): number { return Math.round(n * 1000) / 1000 }
function r2(n: number): number { return Math.round(n * 100) / 100 }

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
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const rawData: any[][] = session.raw_data || []
    const constructs: any[] = session.constructs || []
    const cleaningConfig: any = session.cleaning_config || {}
    const analysisTypes: string[] = session.analysis_type || []
    const scaleMin = cleaningConfig.scaleMin ?? 1
    const scaleMax = cleaningConfig.scaleMax ?? 5
    const missingConfig = cleaningConfig.missing_values || {}
    const duplicateInfo = cleaningConfig.duplicates || { row_indexes: [], action: 'excluded' }

    const excludedRowIndexes = new Set<number>()
    if (duplicateInfo.action === 'excluded') {
      (duplicateInfo.row_indexes || []).forEach((idx: number) => excludedRowIndexes.add(idx))
    }

    const rowIsMissingForExcludeRow = (row: any[]): boolean => {
      for (const c of constructs) {
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

    function getConstructScore(row: any[], construct: any): number | null {
      const cols: number[] = construct.columnIndexes || []
      const reverseIdx: number[] = construct.reverseIndexes || []
      const values: number[] = []
      for (const ci of cols) {
        const raw = row[ci]
        if (raw === null || raw === undefined || String(raw).trim() === '') continue
        const num = Number(raw)
        if (isNaN(num)) continue
        const scored = reverseIdx.includes(ci) ? (scaleMin + scaleMax) - num : num
        values.push(scored)
      }
      if (values.length === 0) return null
      return mean(values)
    }

    const ivConstructs = constructs.filter((c) => c.role === 'IV')
    const dvConstructs = constructs.filter((c) => c.role === 'DV')
    const demoConstructs = constructs.filter((c) => c.role === 'Demographic')
    const scaleConstructs = constructs.filter((c) => c.role === 'IV' || c.role === 'DV')

    const constructScores: Record<string, number[]> = {}
    scaleConstructs.forEach((c) => { constructScores[c.id] = [] })

    cleanedRows.forEach((row) => {
      scaleConstructs.forEach((c) => {
        const score = getConstructScore(row, c)
        if (score !== null) constructScores[c.id].push(score)
      })
    })

    const descriptives = scaleConstructs.map((c) => {
      const scores = constructScores[c.id]
      return {
        name: c.name,
        role: c.role,
        n: scores.length,
        mean: r2(mean(scores)),
        sd: r2(sd(scores)),
        min: r2(Math.min(...scores)),
        max: r2(Math.max(...scores))
      }
    })

    const frequencyTables = demoConstructs.map((c) => {
      const col = (c.columnIndexes || [])[0]
      const counts: Record<string, number> = {}
      let total = 0
      cleanedRows.forEach((row) => {
        const val = row[col]
        if (val === null || val === undefined || String(val).trim() === '') return
        const key = String(val).trim()
        counts[key] = (counts[key] || 0) + 1
        total++
      })
      const rows = Object.entries(counts).map(([label, count]) => ({
        label,
        count,
        percent: r2(total > 0 ? (count / total) * 100 : 0)
      }))
      return { name: c.name, total, rows }
    })

    let correlation: any = null
    if (analysisTypes.includes('correlation') && scaleConstructs.length >= 2) {
      const matrix: any[] = []
      for (const rowC of scaleConstructs) {
        const rowResult: any = { name: rowC.name, cells: [] }
        for (const colC of scaleConstructs) {
          if (rowC.id === colC.id) {
            rowResult.cells.push({ r: 1, p: null, n: constructScores[rowC.id].length })
            continue
          }
          const n = Math.min(constructScores[rowC.id].length, constructScores[colC.id].length)
          const x = constructScores[rowC.id].slice(0, n)
          const y = constructScores[colC.id].slice(0, n)
          const result = pearson(x, y)
          rowResult.cells.push({ r: r3(result.r), p: r3(result.p), n: result.n })
        }
        matrix.push(rowResult)
      }
      correlation = { labels: scaleConstructs.map((c) => c.name), matrix }
    }

    let regression: any = null
    if (analysisTypes.includes('regression') && ivConstructs.length >= 1 && dvConstructs.length >= 1) {
      const dv = dvConstructs[0]
      const n = Math.min(dv ? constructScores[dv.id].length : 0, ...ivConstructs.map((c) => constructScores[c.id].length))

      if (n >= ivConstructs.length + 2) {
        const y = constructScores[dv.id].slice(0, n)
        const X = Array.from({ length: n }, (_, i) => [
          1,
          ...ivConstructs.map((c) => constructScores[c.id][i])
        ])
        const ivNames = ivConstructs.map((c) => c.name)
        const reg = olsRegression(y, X, ivNames)

        regression = {
          dvName: dv.name,
          ivNames,
          variablesEntered: {
            entered: ivNames,
            removed: [],
            method: 'Enter'
          },
          modelSummary: {
            r: r3(reg.multipleR),
            rSquared: r3(reg.rSquared),
            adjRSquared: r3(reg.adjRSquared),
            stdError: r3(reg.stdErrEstimate)
          },
          anova: {
            regression: { ss: r3(reg.ssRegression), df: reg.dfRegression, ms: r3(reg.msRegression) },
            residual: { ss: r3(reg.ssResidual), df: reg.dfResidual, ms: r3(reg.msResidual) },
            total: { ss: r3(reg.ssTotal), df: reg.dfRegression + reg.dfResidual },
            F: r3(reg.F),
            p: r3(reg.fP)
          },
          coefficients: [
            {
              name: '(Constant)',
              B: r3(reg.coefficients[0]),
              SE: r3(reg.standardErrors[0]),
              beta: null,
              t: r3(reg.tStats[0]),
              p: r3(reg.pValues[0])
            },
            ...ivNames.map((name, i) => ({
              name,
              B: r3(reg.coefficients[i + 1]),
              SE: r3(reg.standardErrors[i + 1]),
              beta: r3(reg.betas[i]),
              t: r3(reg.tStats[i + 1]),
              p: r3(reg.pValues[i + 1])
            }))
          ]
        }
      }
    }

    const results = {
      sampleSize: cleanedRows.length,
      excludedRows: rawData.length - cleanedRows.length,
      descriptives,
      frequencyTables,
      correlation,
      regression,
      computedAt: new Date().toISOString()
    }

    await supabase
      .from('quantitative_analysis_sessions')
      .update({ results, status: 'calculated' })
      .eq('id', sessionId)

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Calculation failed' }, { status: 500 })
  }
}
