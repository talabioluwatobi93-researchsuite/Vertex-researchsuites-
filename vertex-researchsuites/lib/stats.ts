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
