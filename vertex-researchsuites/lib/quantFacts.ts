// Facts computed in code for ANY result table. Never calls an AI.
type Tbl = { title: string; headers: string[]; rows: any[][] }
const MEAN_DP = 2

function parseNum(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const m = v.replace(/[*,]/g, '').trim().match(/^[<>=]?\s*(-?\d*\.?\d+)\s*%?$/)
  return m ? Number(m[1]) : null
}
const isTxt = (v: any) => typeof v === 'string' && parseNum(v) === null

function toTables(d: any, title: string, out: Tbl[], depth = 0): void {
  if (!d || depth > 4 || out.length > 12) return
  if (Array.isArray(d)) {
    if (d.length >= 2 && d.every((r: any) => Array.isArray(r))) {
      const head = d[0].every((c: any) => isTxt(c))
      out.push({ title, headers: head ? d[0].map(String) : d[0].map((_: any, i: number) => 'col' + i), rows: head ? d.slice(1) : d })
      return
    }
    if (d.length >= 2 && d.every((r: any) => r && typeof r === 'object' && !Array.isArray(r))) {
      const hs: string[] = Array.from(new Set(d.flatMap((r: any) => Object.keys(r)))) as string[]
      out.push({ title, headers: hs, rows: d.map((r: any) => hs.map((h) => r[h])) })
      return
    }
    d.forEach((x: any) => toTables(x, title, out, depth + 1))
    return
  }
  if (typeof d !== 'object') return
  const t = String(d.table_title || d.title || d.name || d.constructName || title)
  if (Array.isArray(d.columns) && Array.isArray(d.rows)) {
    const cols = d.columns.map((c: any) => String(typeof c === 'string' ? c : (c && (c.name || c.label)) || ''))
    out.push({ title: t, headers: cols, rows: d.rows.map((r: any) => (Array.isArray(r) ? r : cols.map((c: string) => r && r[c]))) })
    return
  }
  Object.keys(d).forEach((k) => toTables(d[k], t, out, depth + 1))
}

function labelIndex(t: Tbl): number {
  const by = t.headers.findIndex((h) => /^(value|label|item|category|variable|predictor|term|source|name|construct|factor|group|test)\b/i.test(h.trim()))
  if (by >= 0) return by
  for (let c = 0; c < t.headers.length; c++) {
    const vals = t.rows.map((r) => r[c])
    if (vals.filter(isTxt).length >= vals.length / 2) return c
  }
  return 0
}

const PRIORITY = [/^(frequency|count|freq)/, /mean|average/, /percent|%/]
const dpFor = (h: string) => (/percent|%/.test(h) ? 1 : /mean|average/.test(h) ? MEAN_DP : 0)

function rankFacts(t: Tbl, li: number): string[] {
  const hl = t.headers.map((h) => h.toLowerCase())
  for (const re of PRIORITY) {
    const ci = hl.findIndex((h, i) => i !== li && re.test(h) && !/cumul|sd|std|error/.test(h))
    if (ci < 0) continue
    const items = t.rows
      .map((r) => ({ label: String(r[li] == null ? '' : r[li]), v: parseNum(r[ci]) }))
      .filter((x) => x.v !== null && x.label !== '' && !/^(total|composite|overall|cumulative)/i.test(x.label))
    if (items.length < 2) return []
    const dp = dpFor(hl[ci])
    const f = Math.pow(10, dp)
    const vals = items.map((x) => Math.round((x.v as number) * f) / f)
    const hi = Math.max(...vals)
    const lo = Math.min(...vals)
    const H = t.headers[ci]
    if (hi === lo) return ['All rows have the same ' + H + ' (' + hi.toFixed(dp) + ').']
    const nm = (v: number) => items.filter((_, i) => vals[i] === v).map((x) => '"' + x.label + '"').join(' and ')
    const tie = (v: number) => (vals.filter((x) => x === v).length > 1 ? ' (tied)' : '')
    const out = ['Column ' + H + ': highest = ' + nm(hi) + tie(hi) + ' (' + hi.toFixed(dp) + '); lowest = ' + nm(lo) + tie(lo) + ' (' + lo.toFixed(dp) + ').']
    if (/freq|count/.test(hl[ci])) {
      const tot = items.reduce((s, x) => s + (x.v as number), 0)
      const s = [...items].sort((a, b) => (b.v as number) - (a.v as number))
      if (tot > 0) {
        const share = (x: number) => ((100 * x) / tot).toFixed(1) + '%'
        out.push('Share of total by size: ' + s.slice(0, 8).map((x) => x.label + ' ' + share(x.v as number)).join(', ') + (s.length > 2 ? '; top two together = ' + share((s[0].v as number) + (s[1].v as number)) : '') + '.')
      }
    }
    return out
  }
  return []
}

function sigFacts(t: Tbl, li: number, alpha: number): string[] {
  const hl = t.headers.map((h) => h.toLowerCase())
  const pc = hl.findIndex((h, i) => i !== li && (/(^|[^a-z])p([^a-z]|$)/.test(h) || /sig/.test(h)))
  if (pc < 0) return []
  const out: string[] = []
  t.rows.forEach((r) => {
    const p = parseNum(r[pc])
    if (p === null || p < 0 || p > 1) return
    const less = typeof r[pc] === 'string' && /^\s*</.test(r[pc])
    const sig = less ? p <= alpha : p < alpha
    out.push(String(r[li] == null ? '' : r[li]) + ': p = ' + String(r[pc]).trim() + ' -> ' + (sig ? 'significant' : 'NOT significant') + ' at alpha ' + alpha)
  })
  return out
}

function starFacts(t: Tbl, li: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  t.rows.forEach((r) =>
    t.headers.forEach((h, ci) => {
      const m = ci !== li && typeof r[ci] === 'string' ? r[ci].trim().match(/^(-?\d*\.\d+)(\*{1,3})$/) : null
      if (!m) return
      const a = String(r[li] == null ? '' : r[li])
      const key = [a, h].sort().join('|')
      if (seen.has(key)) return
      seen.add(key)
      out.push(a + ' with ' + h + ': r = ' + m[1] + ', ' + (m[2].length === 3 ? 'p < .001' : m[2].length === 2 ? 'p < .01' : 'p < .05') + ' (significant)')
    })
  )
  return out.slice(0, 10)
}

export function factsForTable(d: any, alpha: number = 0.05): string[] {
  try {
    const tbls: Tbl[] = []
    toTables(d, '', tbls)
    const out: string[] = []
    tbls.forEach((t) => {
      const li = labelIndex(t)
      const f = [...rankFacts(t, li), ...sigFacts(t, li, alpha), ...starFacts(t, li)]
      if (f.length) out.push(...(tbls.length > 1 && t.title ? [t.title + ':'] : []), ...f)
    })
    return out.slice(0, 16).map((s) => s.slice(0, 400))
  } catch (e) {
    return []
  }
}

export function factsForTables(tables: any[]): any[] {
  try {
    return (Array.isArray(tables) ? tables : [])
      .map((t: any, i: number) => ({ id: i, table: String((t && (t.table_title || t.title || t.name)) || 'table ' + (i + 1)), facts: factsForTable(t) }))
      .filter((x) => x.facts.length)
  } catch (e) {
    return []
  }
}
