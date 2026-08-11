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
  return { r, p, n, df }
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
