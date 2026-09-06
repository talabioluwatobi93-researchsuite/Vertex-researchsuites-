export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
export function sd(arr: number[]): number {
  const m = mean(arr)
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

function betacf(x: number, a: number, b: number): number {
  const MAXIT = 200, EPS = 3e-9, FPMIN = 1e-30
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c; h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
function logGamma(x: number): number {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) { y += 1; ser += cof[j] / y }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}
function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(x, a, b)) / a
  } else {
    return 1 - (bt * betacf(1 - x, b, a)) / b
  }
}
export function tTestPValue(t: number, df: number): number {
  const x = df / (df + t * t)
  return ibeta(x, df / 2, 0.5)
}
export function fTestPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1
  const x = (df1 * f) / (df1 * f + df2)
  return 1 - ibeta(x, df1 / 2, df2 / 2)
}

export function pearson(x: number[], y: number[]) {
  const n = x.length
  const mx = mean(x), my = mean(y)
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  const r = num / Math.sqrt(dx2 * dy2)
  const df = n - 2
  const t = r * Math.sqrt(df / (1 - r * r))
  const p = tTestPValue(t, df)
  const pOneTailed = p / 2
  return { r, p, pOneTailed, n, df }
}

// Assigns average ranks to values, handling ties (standard rank method used by Spearman).
function rank(arr: number[]): number[] {
  const indexed = arr.map((v, i) => ({ v, i }))
  indexed.sort((a, b) => a.v - b.v)
  const ranks = new Array(arr.length)
  let idx = 0
  while (idx < indexed.length) {
    let j = idx
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[idx].v) j++
    const avgRank = (idx + j) / 2 + 1
    for (let k = idx; k <= j; k++) ranks[indexed[k].i] = avgRank
    idx = j + 1
  }
  return ranks
}

// Spearman's rank correlation - ranks both variables, then applies the same Pearson
// math to the ranks. Standard, correct approach; reuses existing tested logic.
export function spearman(x: number[], y: number[]) {
  const rx = rank(x)
  const ry = rank(y)
  return pearson(rx, ry)
}

function invertMatrix(M: number[][]): number[][] {
  const n = M.length
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let i = 0; i < n; i++) {
    let pivot = A[i][i]
    if (Math.abs(pivot) < 1e-12) {
      let swap = -1
      for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > 1e-12) { swap = k; break }
      if (swap === -1) throw new Error('Singular matrix - predictors may be perfectly correlated (multicollinearity)')
      const tmp = A[i]; A[i] = A[swap]; A[swap] = tmp
      pivot = A[i][i]
    }
    for (let j = 0; j < 2 * n; j++) A[i][j] /= pivot
    for (let k = 0; k < n; k++) {
      if (k === i) continue
      const factor = A[k][i]
      for (let j = 0; j < 2 * n; j++) A[k][j] -= factor * A[i][j]
    }
  }
  return A.map(row => row.slice(n))
}
function matMulVec(M: number[][], v: number[]): number[] {
  return M.map(row => row.reduce((s, val, j) => s + val * v[j], 0))
}
function transpose(M: number[][]): number[][] {
  return M[0].map((_, j) => M.map(row => row[j]))
}
function matMul(A: number[][], B: number[][]): number[][] {
  const result: number[][] = []
  for (let i = 0; i < A.length; i++) {
    result.push(B[0].map((_, j) => A[i].reduce((s, val, k) => s + val * B[k][j], 0)))
  }
  return result
}

export function olsRegression(y: number[], X: number[][], ivNames: string[]) {
  const n = y.length
  const k = X[0].length
  const Xt = transpose(X)
  const XtX = matMul(Xt, X)
  const XtXinv = invertMatrix(XtX)
  const Xty = matMulVec(Xt, y)
  const B = matMulVec(XtXinv, Xty)

  const yMean = mean(y)
  const predicted = X.map(row => row.reduce((s, val, j) => s + val * B[j], 0))
  const residuals = y.map((yi, i) => yi - predicted[i])

  const ssTotal = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0)
  const ssResidual = residuals.reduce((s, r) => s + r * r, 0)
  const ssRegression = ssTotal - ssResidual

  const dfRegression = k - 1
  const dfResidual = n - k
  const msRegression = ssRegression / dfRegression
  const msResidual = ssResidual / dfResidual
  const F = msRegression / msResidual
  const fP = fTestPValue(F, dfRegression, dfResidual)

  const rSquared = ssRegression / ssTotal
  const adjRSquared = 1 - (1 - rSquared) * (n - 1) / (n - k)
  const multipleR = Math.sqrt(rSquared)
  const stdErrEstimate = Math.sqrt(msResidual)

  const seCoef = XtXinv.map((row, i) => Math.sqrt(row[i] * msResidual))
  const tStats = B.map((b, i) => b / seCoef[i])
  const pValues = tStats.map(t => tTestPValue(t, dfResidual))

  const yStd = sd(y)
  const xStds: number[] = []
  for (let j = 1; j < k; j++) {
    const col = X.map(row => row[j])
    xStds.push(sd(col))
  }
  const betas = B.slice(1).map((b, i) => b * (xStds[i] / yStd))

  return {
    n, k,
    coefficients: B,
    standardErrors: seCoef,
    tStats, pValues,
    betas,
    rSquared, adjRSquared, multipleR, stdErrEstimate,
    ssRegression, ssResidual, ssTotal,
    dfRegression, dfResidual,
    msRegression, msResidual,
    F, fP,
    ivNames
  }
}

export function tCriticalValue(df: number, alpha: number = 0.05): number {
  let lo = 0, hi = 1000
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const p = tTestPValue(mid, df)
    if (p > alpha) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

export function oneWayAnovaF(groups: number[][]): { f: number; df1: number; df2: number; p: number } {
  const k = groups.length
  const allValues = groups.flat()
  const n = allValues.length
  const grandMean = mean(allValues)

  let ssBetween = 0
  let ssWithin = 0
  groups.forEach((g) => {
    const gMean = mean(g)
    ssBetween += g.length * (gMean - grandMean) ** 2
    g.forEach((v) => { ssWithin += (v - gMean) ** 2 })
  })

  const df1 = k - 1
  const df2 = n - k
  const msBetween = ssBetween / df1
  const msWithin = ssWithin / df2
  const f = msBetween / msWithin
  const p = fTestPValue(f, df1, df2)
  return { f, df1, df2, p }
}

export function leveneTest(groups: number[][]): { f: number; df1: number; df2: number; p: number } {
  const deviations = groups.map((g) => {
    const gMean = mean(g)
    return g.map((v) => Math.abs(v - gMean))
  })
  return oneWayAnovaF(deviations)
}

export function independentTTest(group1: number[], group2: number[]) {
  const n1 = group1.length
  const n2 = group2.length
  const m1 = mean(group1)
  const m2 = mean(group2)
  const sd1 = sd(group1)
  const sd2 = sd(group2)
  const v1 = sd1 * sd1
  const v2 = sd2 * sd2
  const meanDiff = m1 - m2

  // Equal variances assumed
  const dfEqual = n1 + n2 - 2
  const pooledVar = ((n1 - 1) * v1 + (n2 - 1) * v2) / dfEqual
  const seEqual = Math.sqrt(pooledVar * (1 / n1 + 1 / n2))
  const tEqual = meanDiff / seEqual
  const pEqual = tTestPValue(tEqual, dfEqual)
  const tCritEqual = tCriticalValue(dfEqual, 0.05)

  // Equal variances not assumed (Welch)
  const seWelch = Math.sqrt(v1 / n1 + v2 / n2)
  const dfWelchNum = (v1 / n1 + v2 / n2) ** 2
  const dfWelchDenom = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1)
  const dfWelch = dfWelchNum / dfWelchDenom
  const tWelch = meanDiff / seWelch
  const pWelch = tTestPValue(tWelch, dfWelch)
  const tCritWelch = tCriticalValue(dfWelch, 0.05)

  const levene = leveneTest([group1, group2])

  return {
    group1: { n: n1, mean: m1, sd: sd1, sem: sd1 / Math.sqrt(n1) },
    group2: { n: n2, mean: m2, sd: sd2, sem: sd2 / Math.sqrt(n2) },
    levene,
    equalVariances: {
      t: tEqual, df: dfEqual, p: pEqual, meanDiff, seDiff: seEqual,
      ciLower: meanDiff - tCritEqual * seEqual, ciUpper: meanDiff + tCritEqual * seEqual,
    },
    unequalVariances: {
      t: tWelch, df: dfWelch, p: pWelch, meanDiff, seDiff: seWelch,
      ciLower: meanDiff - tCritWelch * seWelch, ciUpper: meanDiff + tCritWelch * seWelch,
    },
  }
}

// ── Studentized range distribution (for Tukey HSD) ──
function normalPDF(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
}
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}
function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

// P(range of k iid N(0,1) <= q), infinite-df case, via Simpson's rule
function wprob(q: number, k: number): number {
  const nSteps = 400
  const lower = -8, upper = 8
  const h = (upper - lower) / nSteps
  let sum = 0
  for (let i = 0; i <= nSteps; i++) {
    const z = lower + i * h
    const val = normalPDF(z) * Math.pow(normalCDF(z) - normalCDF(z - q), k - 1)
    const weight = (i === 0 || i === nSteps) ? 1 : (i % 2 === 0 ? 2 : 4)
    sum += weight * val
  }
  return k * (h / 3) * sum
}

// CDF of the studentized range distribution, finite df, via double numerical integration
function ptukey(q: number, k: number, df: number): number {
  if (q <= 0) return 0
  if (df > 400) return wprob(q, k)
  const nSteps = 200
  const lower = 0.001, upper = 8
  const h = (upper - lower) / nSteps
  const logConst = (df / 2) * Math.log(df / 2) - logGamma(df / 2) + Math.log(2)
  let sum = 0
  for (let i = 0; i <= nSteps; i++) {
    const u = lower + i * h
    const logf = logConst + (df - 1) * Math.log(u) - (df * u * u) / 2
    const f = Math.exp(logf)
    const val = f * wprob(q * u, k)
    const weight = (i === 0 || i === nSteps) ? 1 : (i % 2 === 0 ? 2 : 4)
    sum += weight * val
  }
  return (h / 3) * sum
}

export function tukeyPValue(q: number, k: number, df: number): number {
  const p = 1 - ptukey(q, k, df)
  return Math.min(Math.max(p, 0), 1)
}

export function qTukeyCritical(k: number, df: number, alpha: number = 0.05): number {
  let lo = 0, hi = 50
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const p = 1 - ptukey(mid, k, df)
    if (p > alpha) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

// ── Full One-Way ANOVA (SPSS-style table) + Tukey HSD post-hoc ──
export function oneWayAnova(groups: number[][]) {
  const k = groups.length
  const allValues = groups.flat()
  const n = allValues.length
  const grandMean = mean(allValues)

  let ssBetween = 0
  let ssWithin = 0
  groups.forEach(g => {
    const gMean = mean(g)
    ssBetween += g.length * (gMean - grandMean) ** 2
    g.forEach(v => { ssWithin += (v - gMean) ** 2 })
  })
  const ssTotal = ssBetween + ssWithin
  const dfBetween = k - 1
  const dfWithin = n - k
  const msBetween = ssBetween / dfBetween
  const msWithin = ssWithin / dfWithin
  const f = msBetween / msWithin
  const p = fTestPValue(f, dfBetween, dfWithin)

  const groupStats = groups.map(g => {
    const gn = g.length
    const gMean = mean(g)
    const gSd = sd(g)
    const gSem = gSd / Math.sqrt(gn)
    const tCrit = tCriticalValue(gn - 1, 0.05)
    return {
      n: gn,
      mean: gMean,
      sd: gSd,
      sem: gSem,
      ciLower: gMean - tCrit * gSem,
      ciUpper: gMean + tCrit * gSem,
      min: Math.min(...g),
      max: Math.max(...g)
    }
  })

  const qCrit = qTukeyCritical(k, dfWithin, 0.05)
  const tukey: {
    i: number; j: number; meanDiff: number; seDiff: number
    q: number; p: number; ciLower: number; ciUpper: number
  }[] = []
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const mi = groupStats[i].mean, mj = groupStats[j].mean
      const meanDiff = mi - mj
      const seDiff = Math.sqrt((msWithin / 2) * (1 / groupStats[i].n + 1 / groupStats[j].n))
      const q = Math.abs(meanDiff) / seDiff
      tukey.push({
        i, j, meanDiff, seDiff, q,
        p: tukeyPValue(q, k, dfWithin),
        ciLower: meanDiff - qCrit * seDiff,
        ciUpper: meanDiff + qCrit * seDiff
      })
    }
  }

  return {
    k, n, grandMean,
    ssBetween, ssWithin, ssTotal,
    dfBetween, dfWithin,
    msBetween, msWithin,
    f, p,
    groupStats,
    tukey
  }
}

// ── Chi-Square distribution (regularized lower incomplete gamma function) ──
function lowerIncompleteGammaSeries(a: number, x: number): number {
  // Series expansion, valid for x < a + 1
  let sum = 1 / a
  let term = sum
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n)
    sum += term
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
}
function upperIncompleteGammaCF(a: number, x: number): number {
  // Continued fraction, valid for x >= a + 1
  const FPMIN = 1e-300
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-15) break
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}
function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) return lowerIncompleteGammaSeries(a, x)
  return 1 - upperIncompleteGammaCF(a, x)
}

// Upper-tail p-value for a chi-square statistic with df degrees of freedom
export function chiSquarePValue(chiSq: number, df: number): number {
  if (chiSq <= 0) return 1
  const p = 1 - regularizedGammaP(df / 2, chiSq / 2)
  return Math.min(Math.max(p, 0), 1)
}

// ── Chi-Square Test of Independence (SPSS-style Crosstab + Chi-Square Tests) ──
export function chiSquareTest(rowLabels: string[], colLabels: string[], table: number[][]) {
  const nRows = rowLabels.length
  const nCols = colLabels.length

  const rowTotals = table.map(row => row.reduce((a, b) => a + b, 0))
  const colTotals = colLabels.map((_, j) => table.reduce((sum, row) => sum + row[j], 0))
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0)

  const expected: number[][] = table.map((row, i) =>
    row.map((_, j) => (rowTotals[i] * colTotals[j]) / grandTotal)
  )

  let pearsonChiSq = 0
  let likelihoodRatio = 0
  let minExpected = Infinity
  let cellsUnderFive = 0
  const totalCells = nRows * nCols

  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      const o = table[i][j]
      const e = expected[i][j]
      if (e < minExpected) minExpected = e
      if (e < 5) cellsUnderFive++
      pearsonChiSq += ((o - e) ** 2) / e
      if (o > 0) likelihoodRatio += 2 * o * Math.log(o / e)
    }
  }

  const df = (nRows - 1) * (nCols - 1)
  const pearsonP = chiSquarePValue(pearsonChiSq, df)
  const likelihoodP = chiSquarePValue(likelihoodRatio, df)

  // Linear-by-linear association (Mantel-Haenszel) — only meaningful for ordinal data,
  // but SPSS always reports it in the Chi-Square Tests table, so we compute it too.
  const rowScores = rowLabels.map((_, i) => i + 1)
  const colScores = colLabels.map((_, j) => j + 1)
  const meanRow = rowScores.reduce((a, s, i) => a + s * rowTotals[i], 0) / grandTotal
  const meanCol = colScores.reduce((a, s, j) => a + s * colTotals[j], 0) / grandTotal
  let covXY = 0, varX = 0, varY = 0
  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      covXY += table[i][j] * (rowScores[i] - meanRow) * (colScores[j] - meanCol)
    }
  }
  for (let i = 0; i < nRows; i++) varX += rowTotals[i] * (rowScores[i] - meanRow) ** 2
  for (let j = 0; j < nCols; j++) varY += colTotals[j] * (colScores[j] - meanCol) ** 2
  const r = (varX > 0 && varY > 0) ? covXY / Math.sqrt(varX * varY) : 0
  const linearByLinear = (grandTotal - 1) * r * r
  const linearP = chiSquarePValue(linearByLinear, 1)

  // Cramér's V (effect size)
  const minDim = Math.min(nRows - 1, nCols - 1)
  const cramersV = minDim > 0 ? Math.sqrt(pearsonChiSq / (grandTotal * minDim)) : 0

  const crosstab = rowLabels.map((label, i) => ({
    label,
    observed: table[i],
    expected: expected[i].map(e => Math.round(e * 100) / 100),
    rowTotal: rowTotals[i],
  }))

  return {
    nRows, nCols, grandTotal,
    rowLabels, colLabels,
    colTotals,
    crosstab,
    pearsonChiSq, likelihoodRatio, linearByLinear,
    df,
    pearsonP, likelihoodP, linearP,
    cramersV,
    minExpected,
    cellsUnderFive,
    totalCells,
    pctCellsUnderFive: (cellsUnderFive / totalCells) * 100,
  }
}
