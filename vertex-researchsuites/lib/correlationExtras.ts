import { tTestPValue } from './stats'

function invert(M: number[][]): number[][] | null {
  const n = M.length
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let i = 0; i < n; i++) {
    let p = i
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k
    if (Math.abs(A[p][i]) < 1e-12) return null
    ;[A[i], A[p]] = [A[p], A[i]]
    const d = A[i][i]
    for (let j = 0; j < 2 * n; j++) A[i][j] /= d
    for (let k = 0; k < n; k++) {
      if (k === i) continue
      const f = A[k][i]
      for (let j = 0; j < 2 * n; j++) A[k][j] -= f * A[i][j]
    }
  }
  return A.map((r) => r.slice(n))
}

function corr(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 }
  return sab / Math.sqrt(saa * sbb)
}

// Partial correlation of x and y controlling for the columns in `controls`.
// All arrays must already be matched by respondent (same length, no blanks).
export function partialCorrelation(x: number[], y: number[], controls: number[][]) {
  const n = x.length
  const k = controls.length
  const df = n - 2 - k
  if (k < 1 || df < 1) return null
  const cols = [x, y, ...controls]
  const R = cols.map((a) => cols.map((b) => corr(a, b)))
  const P = invert(R)
  if (!P) return null
  const r = -P[0][1] / Math.sqrt(P[0][0] * P[1][1])
  if (!isFinite(r)) return null
  const p = Math.abs(r) >= 1 ? 0 : tTestPValue(r * Math.sqrt(df / (1 - r * r)), df)
  return { r, p, pOneTailed: p / 2, n, df }
}
