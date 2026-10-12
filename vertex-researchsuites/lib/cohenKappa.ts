// Phase 9 Q5a: Cohen's kappa between two coders who each gave every unit
// (one transcript paragraph) exactly one label (a theme name, or 'none').

export type KappaLevel =
  | 'poor'
  | 'slight'
  | 'fair'
  | 'moderate'
  | 'substantial'
  | 'almost perfect'
  | 'not calculable'

export type KappaResult = {
  kappa: number | null // rounded to 2 decimals, null if it cannot be calculated
  observed: number // share of units where both coders agree (0-1)
  expected: number // agreement expected by chance (0-1)
  n: number // number of units compared
  level: KappaLevel
  reliable: boolean // kappa >= 0.61
  message: string // plain-language sentence for the student
}

export const RELIABLE_KAPPA = 0.61

function levelOf(k: number): KappaLevel {
  if (k < 0) return 'poor'
  if (k <= 0.2) return 'slight'
  if (k <= 0.4) return 'fair'
  if (k <= 0.6) return 'moderate'
  if (k <= 0.8) return 'substantial'
  return 'almost perfect'
}

export function cohenKappa(a: string[], b: string[]): KappaResult {
  if (a.length !== b.length) throw new Error('Coder label lists must be the same length')
  const n = a.length
  if (n === 0) {
    return {
      kappa: null, observed: 0, expected: 0, n: 0, level: 'not calculable', reliable: false,
      message: 'Agreement could not be calculated because there were no paragraphs to compare.',
    }
  }
  const countA: Record<string, number> = {}
  const countB: Record<string, number> = {}
  let agree = 0
  for (let i = 0; i < n; i++) {
    countA[a[i]] = (countA[a[i]] || 0) + 1
    countB[b[i]] = (countB[b[i]] || 0) + 1
    if (a[i] === b[i]) agree++
  }
  const observed = agree / n
  let expected = 0
  for (const label of Object.keys(countA)) {
    expected += (countA[label] / n) * ((countB[label] || 0) / n)
  }
  // Both coders used one single label everywhere: kappa is undefined (0/0).
  if (expected >= 1) {
    const same = observed === 1
    return {
      kappa: same ? 1 : null, observed, expected, n,
      level: same ? 'almost perfect' : 'not calculable', reliable: same,
      message: same
        ? 'Both coders gave every paragraph the same label, so agreement is complete (κ = 1.00), but this gives little evidence about reliability.'
        : 'Agreement could not be calculated for this transcript.',
    }
  }
  const kappa = Math.round(((observed - expected) / (1 - expected)) * 100) / 100
  const level = levelOf(kappa)
  const reliable = kappa >= RELIABLE_KAPPA
  const k = kappa.toFixed(2)
  const message = reliable
    ? `κ = ${k} — ${level} agreement between the two coders. This is at or above the level normally considered reliable (${RELIABLE_KAPPA.toFixed(2)}).`
    : `κ = ${k} — ${level} agreement. This is below the level normally considered reliable agreement between coders (${RELIABLE_KAPPA.toFixed(2)}).`
  return { kappa, observed, expected, n, level, reliable, message }
}

// Build the two label lists for the same ordered units. A unit a coder did not
// label counts as 'none' for that coder.
export function pairLabels(
  units: number[],
  labelsA: Record<string, string>,
  labelsB: Record<string, string>
): { a: string[]; b: string[] } {
  return {
    a: units.map((u) => labelsA[String(u)] || 'none'),
    b: units.map((u) => labelsB[String(u)] || 'none'),
  }
}
