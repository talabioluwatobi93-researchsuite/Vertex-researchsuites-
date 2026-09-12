import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mean, sd, skewness, pearson, spearman, olsRegression, independentTTest, oneWayAnova, chiSquareTest, moderatedRegression, pairedTTest, mannWhitneyU, wilcoxonSignedRank, kruskalWallis, twoWayAnova, sobelMediation, logisticRegression } from '@/lib/stats'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function r3(n: number): number { return Math.round(n * 1000) / 1000 }
function r2(n: number): number { return Math.round(n * 100) / 100 }
function r1(n: number): number { return Math.round(n * 10) / 10 }

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
    const columnHeaders: string[] = session.column_headers || []
    const cleaningConfig: any = session.cleaning_config || {}
    const analysisTypes: string[] = session.analysis_type || []
    const missingConfig = cleaningConfig.missing_values || {}
    const duplicateInfo = cleaningConfig.duplicates || { row_indexes: [], action: 'excluded' }
    const textMappings = cleaningConfig.text_mappings || {}
    const demographicMappings = cleaningConfig.demographic_mappings || {}
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
    const allScaleConstructs = constructs.filter((c) => c.role !== 'Demographic')

    const constructScores: Record<string, number[]> = {}
    allScaleConstructs.forEach((c) => { constructScores[c.id] = [] })

    cleanedRows.forEach((row) => {
      allScaleConstructs.forEach((c) => {
        const score = getConstructScore(row, c)
        if (score !== null) constructScores[c.id].push(score)
      })
    })

    const descriptives = allScaleConstructs.map((c) => {
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

    const frequencyTables = demoConstructs.flatMap((c) => {
      const mapping = textMappings[c.id]
      const reverseMap: Record<string, string> = {}
      if (mapping) {
        Object.entries(mapping).forEach(([text, num]) => {
          reverseMap[String(num)] = text
        })
      }
      const cols: number[] = c.columnIndexes || []
      return cols.map((col) => {
        const tableLabel = columnHeaders[col] || c.name
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
        const rows = Object.entries(counts).map(([rawLabel, count]) => {
          const validPercent = validTotal > 0 ? (count / validTotal) * 100 : 0
          cumulative += validPercent
          return {
            label: (demographicMappings[col] || demographicMappings[String(col)] || {})[rawLabel] || reverseMap[rawLabel] || rawLabel,
            frequency: count,
            percent: r1(allTotal > 0 ? (count / allTotal) * 100 : 0),
            validPercent: r1(validPercent),
            cumulativePercent: r1(cumulative)
          }
        })

        return { name: tableLabel, nValid: validTotal, nMissing: missingCount, rows }
      })
    })

    let correlation: any = null
    if (analysisTypes.includes('correlation') && scaleConstructsList.length >= 2) {
      const includeSpearman = session.correlation_config?.includeSpearman === true
      const matrix: any[] = []
      const spearmanMatrix: any[] | null = includeSpearman ? [] : null
      for (const rowC of scaleConstructsList) {
        const rowResult: any = { name: rowC.name, cells: [] }
        const spearmanRowResult: any = includeSpearman ? { name: rowC.name, cells: [] } : null
        for (const colC of scaleConstructsList) {
          if (rowC.id === colC.id) {
            rowResult.cells.push({ r: 1, p: null, pOneTailed: null, n: constructScores[rowC.id].length })
            if (includeSpearman) {
              spearmanRowResult.cells.push({ r: 1, p: null, pOneTailed: null, n: constructScores[rowC.id].length })
            }
            continue
          }
          const n = Math.min(constructScores[rowC.id].length, constructScores[colC.id].length)
          const x = constructScores[rowC.id].slice(0, n)
          const y = constructScores[colC.id].slice(0, n)
          const result = pearson(x, y)
          rowResult.cells.push({ r: r3(result.r), p: r3(result.p), pOneTailed: r3(result.pOneTailed), n: result.n })
          if (includeSpearman) {
            const spearmanResult = spearman(x, y)
            spearmanRowResult.cells.push({ r: r3(spearmanResult.r), p: r3(spearmanResult.p), pOneTailed: r3(spearmanResult.pOneTailed), n: spearmanResult.n })
          }
        }
        matrix.push(rowResult)
        if (spearmanMatrix) {
          spearmanMatrix.push(spearmanRowResult)
        }
      }
      // Flag constructs with notably skewed distributions (|skew| > 1 is a common rule of
      // thumb for "substantial" skew) - used to recommend Spearman as more appropriate
      // for that construct's correlations, without hiding either result.
      const skewFlags: Record<string, boolean> = {}
      scaleConstructsList.forEach((c) => {
        const skew = constructScores[c.id].length >= 3 ? skewness(constructScores[c.id]) : 0
        skewFlags[c.id] = Math.abs(skew) > 1
      })
      const anySkewed = scaleConstructsList.some((c) => skewFlags[c.id])
      const recommendation = anySkewed
        ? (includeSpearman
            ? 'Some variables show notable skew - Spearman may be more robust for those correlations. Both are reported below.'
            : "Some variables show notable skew - consider also requesting Spearman's rank correlation for more robust results.")
        : 'Data distributions appear reasonably normal - Pearson (the default correlation) is appropriate here.'

      correlation = { labels: scaleConstructsList.map((c) => c.name), matrix, spearmanMatrix, skewFlags, recommendation }
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


    let logistic: any = null
    if (analysisTypes.includes('logistic') && ivConstructs.length >= 1 && dvConstructs.length >= 1) {
      const dv = dvConstructs[0]
      const dvScores: number[] | undefined = constructScores[dv.id]
      const n = dvScores ? Math.min(dvScores.length, ...ivConstructs.map((c: any) => constructScores[c.id].length)) : 0

      if (n >= ivConstructs.length + 2 && dvScores) {
        const yFull = dvScores.slice(0, n)
        const isBinary = yFull.every((v: number) => v === 0 || v === 1)
        const uniqueVals = new Set(yFull)

        if (isBinary && uniqueVals.size === 2) {
          const X = Array.from({ length: n }, (_, i) => [
            ...ivConstructs.map((c: any) => constructScores[c.id][i])
          ])
          const ivNames = ivConstructs.map((c: any) => c.name)
          const logResult = logisticRegression(yFull, X, ivNames)
          logistic = {
            dvName: dv.name,
            ivNames,
            ...logResult
          }
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
    let moderation: any = null
    if (analysisTypes.includes('moderation') && session.moderation_config) {
      const { predictorConstructId, moderatorConstructId, outcomeConstructId } = session.moderation_config
      const predictorScores = constructScores[predictorConstructId]
      const moderatorScores = constructScores[moderatorConstructId]
      const outcomeScores = constructScores[outcomeConstructId]
      if (predictorScores && moderatorScores && outcomeScores) {
        const n = Math.min(predictorScores.length, moderatorScores.length, outcomeScores.length)
        if (n >= 4) {
          const y = outcomeScores.slice(0, n)
          const predictor = predictorScores.slice(0, n)
          const moderatorArr = moderatorScores.slice(0, n)
          const modResult = moderatedRegression(y, predictor, moderatorArr)
          const predictorName = (constructs.find((c: any) => c.id === predictorConstructId) || {}).name || 'Predictor'
          const moderatorName = (constructs.find((c: any) => c.id === moderatorConstructId) || {}).name || 'Moderator'
          const outcomeName = (constructs.find((c: any) => c.id === outcomeConstructId) || {}).name || 'Outcome'
          const reg = modResult.ss
          moderation = {
            predictorName,
            moderatorName,
            outcomeName,
            modelSummary: {
              r: r3(reg.multipleR),
              rSquared: r3(reg.rSquared),
              adjRSquared: r3(reg.adjRSquared),
              stdError: r3(reg.stdErrEstimate)
            },
            anova: {
              regression: { ss: r3(reg.ssRegression), df: reg.dfRegression, ms: r3(reg.msRegression) },
              residual: { ss: r3(reg.ssResidual), df: reg.dfResidual, ms: r3(reg.msResidual) },
              total: { ss: r3(reg.ssTotal), df: reg.dfRegression + reg.dfResidual }
            },
            F: r3(reg.F),
            p: r3(reg.pF),
            coefficients: [
              { name: '(Constant)', B: r3(reg.coefficients[0]), SE: r3(reg.standardErrors[0]), beta: null, t: r3(reg.tStats[0]), p: r3(reg.pValues[0]) },
              { name: predictorName, B: r3(reg.coefficients[1]), SE: r3(reg.standardErrors[1]), beta: r3(reg.betas[0]), t: r3(reg.tStats[1]), p: r3(reg.pValues[1]) },
              { name: moderatorName, B: r3(reg.coefficients[2]), SE: r3(reg.standardErrors[2]), beta: r3(reg.betas[1]), t: r3(reg.tStats[2]), p: r3(reg.pValues[2]) },
              { name: `${predictorName} x ${moderatorName} (Interaction)`, B: r3(reg.coefficients[3]), SE: r3(reg.standardErrors[3]), beta: r3(reg.betas[2]), t: r3(reg.tStats[3]), p: r3(reg.pValues[3]) }
            ]
          }
        }
      }
    }
    let paired: any = null
    if (analysisTypes.includes('paired') && session.paired_config) {
      const { group1ConstructId, group2ConstructId, group1Label, group2Label } = session.paired_config
      const group1Scores = constructScores[group1ConstructId]
      const group2Scores = constructScores[group2ConstructId]
      if (group1Scores && group2Scores) {
        const n = Math.min(group1Scores.length, group2Scores.length)
        if (n >= 2) {
          const before = group1Scores.slice(0, n)
          const after = group2Scores.slice(0, n)
          const pairedResult = pairedTTest(before, after)
          const group1Name = group1Label || (constructs.find((c: any) => c.id === group1ConstructId) || {}).name || 'Group 1'
          const group2Name = group2Label || (constructs.find((c: any) => c.id === group2ConstructId) || {}).name || 'Group 2'
          paired = {
            group1Name,
            group2Name,
            ...pairedResult
          }
        }
      }
    }

    let mannwhitney: any = null
    if (analysisTypes.includes('mannwhitney') && session.mannwhitney_config) {
      const { groupConstructId, outcomeConstructId } = session.mannwhitney_config
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
          const mwResult = mannWhitneyU(group1Scores, group2Scores)
          mannwhitney = {
            groupVariableName: groupConstruct.name,
            outcomeVariableName: outcomeConstruct.name,
            group1Label,
            group2Label,
            ...mwResult
          }
        }
      }
    }

    let wilcoxon: any = null
    if (analysisTypes.includes('wilcoxon') && session.wilcoxon_config) {
      const { group1ConstructId, group2ConstructId, group1Label, group2Label } = session.wilcoxon_config
      const group1Scores = constructScores[group1ConstructId]
      const group2Scores = constructScores[group2ConstructId]
      if (group1Scores && group2Scores) {
        const n = Math.min(group1Scores.length, group2Scores.length)
        if (n >= 2) {
          const before = group1Scores.slice(0, n)
          const after = group2Scores.slice(0, n)
          const wilcoxonResult = wilcoxonSignedRank(before, after)
          const group1Name = group1Label || (constructs.find((c: any) => c.id === group1ConstructId) || {}).name || 'Group 1'
          const group2Name = group2Label || (constructs.find((c: any) => c.id === group2ConstructId) || {}).name || 'Group 2'
          wilcoxon = {
            group1Name,
            group2Name,
            ...wilcoxonResult
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

    let kruskalwallis: any = null
    if (analysisTypes.includes('kruskalwallis') && session.kruskalwallis_config) {
      const { groupConstructId, outcomeConstructId } = session.kruskalwallis_config
      const groupConstruct = constructs.find((c: any) => c.id === groupConstructId)
      const outcomeConstruct = constructs.find((c: any) => c.id === outcomeConstructId)

      if (groupConstruct && outcomeConstruct) {
        const groupCol = groupConstruct.columnIndexes[0]
        const groupLabels = Array.from(new Set(
          cleanedRows.map((r: any[]) => String(r[groupCol]).trim())
        )).filter(Boolean) as string[]

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
          const kwResult = kruskalWallis(groups)
          kruskalwallis = {
            groupVariableName: groupConstruct.name,
            outcomeVariableName: outcomeConstruct.name,
            groupLabels: validLabels,
            ...kwResult
          }
        }
      }
    }

    let twowayanova: any = null
    if (analysisTypes.includes('twowayanova') && session.twowayanova_config) {
      const { factorAConstructId, factorBConstructId, outcomeConstructId } = session.twowayanova_config
      const factorAConstruct = constructs.find((c: any) => c.id === factorAConstructId)
      const factorBConstruct = constructs.find((c: any) => c.id === factorBConstructId)
      const outcomeConstruct = constructs.find((c: any) => c.id === outcomeConstructId)

      if (factorAConstruct && factorBConstruct && outcomeConstruct) {
        const colA = factorAConstruct.columnIndexes[0]
        const colB = factorBConstruct.columnIndexes[0]

        const factorAValues: string[] = []
        const factorBValues: string[] = []
        const outcomeValues: number[] = []

        const mappingA = textMappings[factorAConstruct.id]
        const reverseMapA: Record<string, string> = {}
        if (mappingA) Object.entries(mappingA).forEach(([text, num]: [string, any]) => { reverseMapA[String(num)] = text })

        const mappingB = textMappings[factorBConstruct.id]
        const reverseMapB: Record<string, string> = {}
        if (mappingB) Object.entries(mappingB).forEach(([text, num]: [string, any]) => { reverseMapB[String(num)] = text })

        function resolveGroupLabel(raw: string, col: number, reverseMap: Record<string, string>): string {
          return (demographicMappings[col] || demographicMappings[String(col)] || {})[raw] || reverseMap[raw] || raw
        }

        cleanedRows.forEach((row: any[]) => {
          const rawLabelA = String(row[colA]).trim()
          const rawLabelB = String(row[colB]).trim()
          const labelA = resolveGroupLabel(rawLabelA, colA, reverseMapA)
          const labelB = resolveGroupLabel(rawLabelB, colB, reverseMapB)
          const score = getConstructScore(row, outcomeConstruct)
          if (!rawLabelA || !rawLabelB || score === null) return
          factorAValues.push(labelA)
          factorBValues.push(labelB)
          outcomeValues.push(score)
        })

        const levelsACheck = Array.from(new Set(factorAValues))
        const levelsBCheck = Array.from(new Set(factorBValues))

        if (levelsACheck.length >= 2 && levelsBCheck.length >= 2 && outcomeValues.length >= (levelsACheck.length * levelsBCheck.length) + 1) {
          const twaResult = twoWayAnova(factorAValues, factorBValues, outcomeValues)
          twowayanova = {
            factorAName: factorAConstruct.name,
            factorBName: factorBConstruct.name,
            outcomeVariableName: outcomeConstruct.name,
            anovaTable: [
              { source: factorAConstruct.name, ss: r3(twaResult.factorA.ss), df: twaResult.factorA.df, ms: r3(twaResult.factorA.ms), F: r3(twaResult.factorA.f), p: r3(twaResult.factorA.p) },
              { source: factorBConstruct.name, ss: r3(twaResult.factorB.ss), df: twaResult.factorB.df, ms: r3(twaResult.factorB.ms), F: r3(twaResult.factorB.f), p: r3(twaResult.factorB.p) },
              { source: `${factorAConstruct.name} x ${factorBConstruct.name} (Interaction)`, ss: r3(twaResult.interaction.ss), df: twaResult.interaction.df, ms: r3(twaResult.interaction.ms), F: r3(twaResult.interaction.f), p: r3(twaResult.interaction.p) },
              { source: 'Error', ss: r3(twaResult.error.ss), df: twaResult.error.df, ms: r3(twaResult.error.ms), F: null, p: null },
              { source: 'Total', ss: r3(twaResult.total.ss), df: twaResult.total.df, ms: null, F: null, p: null }
            ],
            cellStats: twaResult.cellStats,
            marginalA: twaResult.marginalA,
            marginalB: twaResult.marginalB
          }
        }
      }
    }

    let mediation: any = null
    if (analysisTypes.includes('mediation') && session.mediation_config) {
      const { predictorConstructId, mediatorConstructId, outcomeConstructId } = session.mediation_config
      const predictorScores = constructScores[predictorConstructId]
      const mediatorScores = constructScores[mediatorConstructId]
      const outcomeScores = constructScores[outcomeConstructId]

      if (predictorScores && mediatorScores && outcomeScores) {
        const n = Math.min(predictorScores.length, mediatorScores.length, outcomeScores.length)
        if (n >= 4) {
          const predictor = predictorScores.slice(0, n)
          const mediatorArr = mediatorScores.slice(0, n)
          const outcomeArr = outcomeScores.slice(0, n)
          const medResult = sobelMediation(predictor, mediatorArr, outcomeArr)

          const predictorName = (constructs.find((c: any) => c.id === predictorConstructId) || {}).name || 'Predictor'
          const mediatorName = (constructs.find((c: any) => c.id === mediatorConstructId) || {}).name || 'Mediator'
          const outcomeName = (constructs.find((c: any) => c.id === outcomeConstructId) || {}).name || 'Outcome'

          mediation = {
            predictorName,
            mediatorName,
            outcomeName,
            ...medResult
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

        const mappingRow = textMappings[rowConstruct.id]
        const reverseMapRow: Record<string, string> = {}
        if (mappingRow) Object.entries(mappingRow).forEach(([text, num]: [string, any]) => { reverseMapRow[String(num)] = text })

        const mappingCol = textMappings[colConstruct.id]
        const reverseMapCol: Record<string, string> = {}
        if (mappingCol) Object.entries(mappingCol).forEach(([text, num]: [string, any]) => { reverseMapCol[String(num)] = text })

        function resolveCatLabel(raw: string, col: number, reverseMap: Record<string, string>): string {
          return (demographicMappings[col] || demographicMappings[String(col)] || {})[raw] || reverseMap[raw] || raw
        }

        const rowLabels = Array.from(new Set(
          cleanedRows.map((r: any[]) => resolveCatLabel(String(r[rowCol]).trim(), rowCol, reverseMapRow)).filter(Boolean)
        )) as string[]
        const colLabels = Array.from(new Set(
          cleanedRows.map((r: any[]) => resolveCatLabel(String(r[colCol]).trim(), colCol, reverseMapCol)).filter(Boolean)
        )) as string[]

        const table: number[][] = rowLabels.map(() => colLabels.map(() => 0))
        const rowIndex: Record<string, number> = {}
        rowLabels.forEach((l, i) => { rowIndex[l] = i })
        const colIndex: Record<string, number> = {}
        colLabels.forEach((l, j) => { colIndex[l] = j })

        cleanedRows.forEach((row: any[]) => {
          const rLabel = resolveCatLabel(String(row[rowCol]).trim(), rowCol, reverseMapRow)
          const cLabel = resolveCatLabel(String(row[colCol]).trim(), colCol, reverseMapCol)
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

    // NEW: item-level descriptive table for each scale construct (IV/DV) - one row per
    // question ITEM (not the whole construct). Matches the fully-expanded Likert breakdown
    // format (per-point %, Mean, SD, Overall %). Fully dynamic - works for any scale range
    // and any number of items, nothing hardcoded.
    const itemDescriptives = allScaleConstructs.map((c) => {
      const cols: number[] = c.columnIndexes || []
      const reverseIdx: number[] = c.reverseIndexes || []
      const scaleMin = c.scaleMin ?? 1
      const scaleMax = c.scaleMax ?? 5

      const items = cols.map((col) => {
        const values: number[] = []
        const rawCounts: Record<number, number> = {}

        cleanedRows.forEach((row) => {
          let num = resolveNumeric(row[col], c.id)
          if (num === null) return
          if (reverseIdx.includes(col)) num = (scaleMin + scaleMax) - num
          values.push(num)
          rawCounts[num] = (rawCounts[num] || 0) + 1
        })

        const n = values.length
        const pointPercents: Record<number, number> = {}
        for (let p = scaleMin; p <= scaleMax; p++) {
          pointPercents[p] = n > 0 ? r1(((rawCounts[p] || 0) / n) * 100) : 0
        }

        const m = n > 0 ? mean(values) : null
        const s = n > 0 ? sd(values) : null
        const overallPercent = m !== null ? r1((m / scaleMax) * 100) : null

        return {
          label: columnHeaders[col] || `Item ${col}`,
          n,
          pointPercents,
          mean: m !== null ? r2(m) : null,
          sd: s !== null ? r2(s) : null,
          overallPercent
        }
      })

      const totalMean = items.length > 0
        ? r2(mean(items.filter((it) => it.mean !== null).map((it) => it.mean as number)))
        : null
      const totalSD = items.length > 0
        ? r2(mean(items.filter((it) => it.sd !== null).map((it) => it.sd as number)))
        : null
      const totalOverallPercent = items.length > 0
        ? r1(mean(items.filter((it) => it.overallPercent !== null).map((it) => it.overallPercent as number)))
        : null

      return { constructName: c.name, scaleMin, scaleMax, items, totalMean, totalSD, totalOverallPercent }
    })

    const results = {
      sampleSize: cleanedRows.length,
      excludedRows: rawData.length - cleanedRows.length,
      descriptives: analysisTypes.includes('descriptive') ? descriptives : undefined,
      frequencyTables: analysisTypes.includes('descriptive') ? frequencyTables : undefined,
      itemDescriptives: analysisTypes.includes('descriptive') ? itemDescriptives : undefined,
      correlation,
      regression,
      ttest,
      anova,
      chisquare,
      moderation,
      paired,
      mannwhitney,
      wilcoxon,
      kruskalwallis,
      twowayanova,
      mediation,
      logistic,
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
