import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mean, sd, pearson, olsRegression, independentTTest, oneWayAnova, chiSquareTest } from '@/lib/stats'

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
    const missingConfig = cleaningConfig.missing_values || {}
    const duplicateInfo = cleaningConfig.duplicates || { row_indexes: [], action: 'excluded' }
    const textMappings = cleaningConfig.text_mappings || {}
    const straightLining = cleaningConfig.straight_lining || { detected_row_indexes: [], action: 'excluded' }

    const excludedRowIndexes = new Set<number>()
    if (duplicateInfo.action === 'excluded') {
      (duplicateInfo.row_indexes || []).forEach((idx: number) => excludedRowIndexes.add(idx))
    }
    if (straightLining.action === 'excluded') {
      (straightLining.detected_row_indexes || []).forEach((idx: number) => excludedRowIndexes.add(idx))
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

    // resolve a raw cell to a number, applying the construct's text-to-value mapping first if needed
    function resolveNumeric(raw: any, constructId: string): number | null {
      if (raw === null || raw === undefined || String(raw).trim() === '') return null
      const str = String(raw).trim()
      const direct = Number(str)
      if (!isNaN(direct)) return direct
      const mapping = textMappings[constructId]
      if (mapping && mapping[str] !== undefined) return Number(mapping[str])
      return null
    }

    function getConstructScore(row: any[], construct: any): number | null {
      const cols: number[] = construct.columnIndexes || []
      const reverseIdx: number[] = construct.reverseIndexes || []
      const scaleMin = construct.scaleMin ?? 1
      const scaleMax = construct.scaleMax ?? 5
      const scaleReversed = !!construct.scaleReversed

      const values: number[] = []
      for (const ci of cols) {
        let num = resolveNumeric(row[ci], construct.id)
        if (num === null) continue
        if (scaleReversed) num = (scaleMin + scaleMax) - num
        const scored = reverseIdx.includes(ci) ? (scaleMin + scaleMax) - num : num
        values.push(scored)
      }
      if (values.length === 0) return null
      return mean(values)
    }

    const ivConstructs = constructs.filter((c) => c.role === 'IV')
    const dvConstructs = constructs.filter((c) => c.role === 'DV')
    const demoConstructs = constructs.filter((c) => c.role === 'Demographic')
    const scaleConstructsList = constructs.filter((c) => c.role === 'IV' || c.role === 'DV')

    const constructScores: Record<string, number[]> = {}
    scaleConstructsList.forEach((c) => { constructScores[c.id] = [] })

    cleanedRows.forEach((row) => {
      scaleConstructsList.forEach((c) => {
        const score = getConstructScore(row, c)
        if (score !== null) constructScores[c.id].push(score)
      })
    })

    const descriptives = scaleConstructsList.map((c) => {
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
      let validTotal = 0
      let missingCount = 0

      cleanedRows.forEach((row) => {
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
          percent: r2(allTotal > 0 ? (count / allTotal) * 100 : 0),
          validPercent: r2(validPercent),
          cumulativePercent: r2(cumulative)
        }
      })

      return { name: c.name, nValid: validTotal, nMissing: missingCount, rows }
    })

    let correlation: any = null
    if (analysisTypes.includes('correlation') && scaleConstructsList.length >= 2) {
      const matrix: any[] = []
      for (const rowC of scaleConstructsList) {
        const rowResult: any = { name: rowC.name, cells: [] }
        for (const colC of scaleConstructsList) {
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
      correlation = { labels: scaleConstructsList.map((c) => c.name), matrix }
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
          variablesEntered: { entered: ivNames, removed: [], method: 'Enter' },
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
            { name: '(Constant)', B: r3(reg.coefficients[0]), SE: r3(reg.standardErrors[0]), beta: null, t: r3(reg.tStats[0]), p: r3(reg.pValues[0]) },
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


    let ttest: any = null
    if (analysisTypes.includes('ttest') && session.ttest_config) {
      const { groupConstructId, outcomeConstructId } = session.ttest_config
      const groupConstruct = constructs.find((c: any) => c.id === groupConstructId)
      const outcomeConstruct = constructs.find((c: any) => c.id === outcomeConstructId)

      if (groupConstruct && outcomeConstruct) {
        const groupCol = groupConstruct.columnIndexes[0]
        const group1Label = Array.from(new Set(cleanedRows.map((r: any[]) => String(r[groupCol]).trim()).filter(Boolean)))[0]
        const group2Label = Array.from(new Set(cleanedRows.map((r: any[]) => String(r[groupCol]).trim()).filter(Boolean)))[1]

        const group1Scores: number[] = []
        const group2Scores: number[] = []

        cleanedRows.forEach((row: any[]) => {
          const label = String(row[groupCol]).trim()
          const score = getConstructScore(row, outcomeConstruct)
          if (score === null) return
          if (label === group1Label) group1Scores.push(score)
          else if (label === group2Label) group2Scores.push(score)
        })

        if (group1Scores.length >= 2 && group2Scores.length >= 2) {
          const ttestResult = independentTTest(group1Scores, group2Scores)
          ttest = {
            groupVariableName: groupConstruct.name,
            outcomeVariableName: outcomeConstruct.name,
            group1Label, group2Label,
            ...ttestResult,
          }
        }
      }
    }
    let anova: any = null
    if (analysisTypes.includes('anova') && session.anova_config) {
      const { groupConstructId, outcomeConstructId } = session.anova_config
      const groupConstruct = constructs.find((c: any) => c.id === groupConstructId)
      const outcomeConstruct = constructs.find((c: any) => c.id === outcomeConstructId)

      if (groupConstruct && outcomeConstruct) {
        const groupCol = groupConstruct.columnIndexes[0]
        const groupLabels = Array.from(new Set(
          cleanedRows.map((r: any[]) => String(r[groupCol]).trim()).filter(Boolean)
        )) as string[]

        const groupedScores: Record<string, number[]> = {}
        groupLabels.forEach((label) => { groupedScores[label] = [] })

        cleanedRows.forEach((row: any[]) => {
          const label = String(row[groupCol]).trim()
          const score = getConstructScore(row, outcomeConstruct)
          if (score === null) return
          if (groupedScores[label] !== undefined) groupedScores[label].push(score)
        })

        const validLabels = groupLabels.filter((label) => groupedScores[label].length >= 2)

        if (validLabels.length >= 3) {
          const groups = validLabels.map((label) => groupedScores[label])
          const a = oneWayAnova(groups)
          anova = {
            groupVariableName: groupConstruct.name,
            outcomeVariableName: outcomeConstruct.name,
            groupLabels: validLabels,
            k: a.k,
            n: a.n,
            grandMean: r3(a.grandMean),
            ssBetween: r3(a.ssBetween),
            ssWithin: r3(a.ssWithin),
            ssTotal: r3(a.ssTotal),
            dfBetween: a.dfBetween,
            dfWithin: a.dfWithin,
            msBetween: r3(a.msBetween),
            msWithin: r3(a.msWithin),
            F: r3(a.f),
            p: r3(a.p),
            groupStats: a.groupStats.map((g, i) => ({
              label: validLabels[i],
              n: g.n,
              mean: r2(g.mean),
              sd: r2(g.sd),
              sem: r2(g.sem),
              ciLower: r2(g.ciLower),
              ciUpper: r2(g.ciUpper),
              min: r2(g.min),
              max: r2(g.max),
            })),
            tukey: a.tukey.map((t) => ({
              groupA: validLabels[t.i],
              groupB: validLabels[t.j],
              meanDiff: r3(t.meanDiff),
              seDiff: r3(t.seDiff),
              p: r3(t.p),
              ciLower: r3(t.ciLower),
              ciUpper: r3(t.ciUpper),
            })),
          }
        }
      }
    }

    let chisquare: any = null
    if (analysisTypes.includes('chisquare') && session.chisquare_config) {
      const { rowConstructId, colConstructId } = session.chisquare_config
      const rowConstruct = constructs.find((c: any) => c.id === rowConstructId)
      const colConstruct = constructs.find((c: any) => c.id === colConstructId)

      if (rowConstruct && colConstruct) {
        const rowCol = rowConstruct.columnIndexes[0]
        const colCol = colConstruct.columnIndexes[0]

        const rowLabels = Array.from(new Set(
          cleanedRows.map((r: any[]) => String(r[rowCol]).trim()).filter(Boolean)
        )) as string[]
        const colLabels = Array.from(new Set(
          cleanedRows.map((r: any[]) => String(r[colCol]).trim()).filter(Boolean)
        )) as string[]

        const table: number[][] = rowLabels.map(() => colLabels.map(() => 0))
        const rowIndex: Record<string, number> = {}
        rowLabels.forEach((l, i) => { rowIndex[l] = i })
        const colIndex: Record<string, number> = {}
        colLabels.forEach((l, j) => { colIndex[l] = j })

        cleanedRows.forEach((row: any[]) => {
          const rLabel = String(row[rowCol]).trim()
          const cLabel = String(row[colCol]).trim()
          if (!rLabel || !cLabel) return
          if (rowIndex[rLabel] === undefined || colIndex[cLabel] === undefined) return
          table[rowIndex[rLabel]][colIndex[cLabel]]++
        })

        if (rowLabels.length >= 2 && colLabels.length >= 2) {
          const cs = chiSquareTest(rowLabels, colLabels, table)
          chisquare = {
            rowVariableName: rowConstruct.name,
            colVariableName: colConstruct.name,
            rowLabels: cs.rowLabels,
            colLabels: cs.colLabels,
            colTotals: cs.colTotals,
            grandTotal: cs.grandTotal,
            crosstab: cs.crosstab,
            df: cs.df,
            pearsonChiSq: r3(cs.pearsonChiSq),
            pearsonP: r3(cs.pearsonP),
            likelihoodRatio: r3(cs.likelihoodRatio),
            likelihoodP: r3(cs.likelihoodP),
            linearByLinear: r3(cs.linearByLinear),
            linearP: r3(cs.linearP),
            cramersV: r3(cs.cramersV),
            minExpected: r2(cs.minExpected),
            cellsUnderFive: cs.cellsUnderFive,
            totalCells: cs.totalCells,
            pctCellsUnderFive: r2(cs.pctCellsUnderFive),
          }
        }
      }
    }

    const results = {
      sampleSize: cleanedRows.length,
      excludedRows: rawData.length - cleanedRows.length,
      descriptives: analysisTypes.includes('descriptive') ? descriptives : undefined,
      frequencyTables: analysisTypes.includes('descriptive') ? frequencyTables : undefined,
      correlation,
      regression,
      ttest,
      anova,
      chisquare,
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
