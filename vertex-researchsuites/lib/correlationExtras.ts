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

// Point-biserial (0/1 with a scale score) and phi (0/1 with 0/1) are both Pearson on the coded values.
// `g` must contain only 0 and 1, both present. Arrays must already be matched by respondent.
export function binaryCorrelation(g: number[], y: number[]) {
  const n = g.length
  const df = n - 2
  if (n !== y.length || df < 1) return null
  const ones = g.filter((v) => v === 1).length
  if (ones === 0 || ones === n || g.some((v) => v !== 0 && v !== 1)) return null
  const r = corr(g, y)
  if (!isFinite(r)) return null
  const p = Math.abs(r) >= 1 ? 0 : tTestPValue(r * Math.sqrt(df / (1 - r * r)), df)
  return { r, p, pOneTailed: p / 2, n, df }
}

// Item analysis for one construct. `cols` = one array per item, all the same length,
// already matched by respondent (only respondents who answered every item).
// Returns the item-by-item Pearson matrix and each item's corrected item-total correlation
// (item vs the sum of the OTHER items).
export function itemAnalysis(cols: number[][]) {
  const k = cols.length
  if (k < 2) return null
  const n = cols[0].length
  const df = n - 2
  if (df < 1 || cols.some((c) => c.length !== n)) return null
  const cell = (a: number[], b: number[]) => {
    const r = corr(a, b)
    if (!isFinite(r)) return { r: null as number | null, p: null as number | null }
    const p = Math.abs(r) >= 1 ? 0 : tTestPValue(r * Math.sqrt(df / (1 - r * r)), df)
    return { r, p }
  }
  const matrix = cols.map((a, i) => cols.map((b, j) => (i === j ? { r: 1 as number | null, p: null as number | null } : cell(a, b))))
  const itemTotal = cols.map((a, i) => {
    const rest = a.map((_, m) => cols.reduce((s, c, j) => (j === i ? s : s + c[m]), 0))
    return cell(a, rest)
  })
  return { n, df, k, matrix, itemTotal }
}
