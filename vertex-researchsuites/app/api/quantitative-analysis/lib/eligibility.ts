export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

interface Construct {
  id: string;
  name: string;
  columnIndexes?: number[];
}

type ScoreMap = Record<string, number[]>;

export function checkCorrelation(scaleConstructsList: Construct[]): EligibilityResult {
  if (scaleConstructsList.length < 2) {
    return { eligible: false, reason: 'Correlation needs at least 2 scale-level constructs.' };
  }
  return { eligible: true };
}

export function checkRegression(iv: Construct[], dv: Construct[], scores: ScoreMap): EligibilityResult {
  if (iv.length < 1 || dv.length < 1) {
    return { eligible: false, reason: 'Regression needs at least 1 IV and 1 DV construct.' };
  }
  const n = Math.min(scores[dv[0].id]?.length ?? 0, ...iv.map(c => scores[c.id]?.length ?? 0));
  if (n < iv.length + 2) {
    return { eligible: false, reason: `Need n >= ${iv.length + 2} for ${iv.length} predictor(s); have n=${n}.` };
  }
  return { eligible: true };
}

export function checkLogistic(iv: Construct[], dv: Construct[], scores: ScoreMap): EligibilityResult {
  if (iv.length < 1 || dv.length < 1) {
    return { eligible: false, reason: 'Logistic regression needs at least 1 IV and 1 DV construct.' };
  }
  const dvScores = scores[dv[0].id];
  if (!dvScores) return { eligible: false, reason: 'DV scores not found.' };
  const n = Math.min(dvScores.length, ...iv.map(c => scores[c.id]?.length ?? 0));
  if (n < iv.length + 2) {
    return { eligible: false, reason: `Need n >= ${iv.length + 2}; have n=${n}.` };
  }
  const yFull = dvScores.slice(0, n);
  const isBinary = yFull.every((v: number) => v === 0 || v === 1);
  const uniqueVals = new Set(yFull);
  if (!isBinary || uniqueVals.size !== 2) {
    return { eligible: false, reason: 'Outcome must be binary (exactly two values, 0/1) for logistic regression. Consider linear regression if it is continuous.' };
  }
  return { eligible: true };
}

export function checkConfigPresent(session: any, key: string, label: string): EligibilityResult {
  if (!session[key]) {
    return { eligible: false, reason: `${label} needs its configuration (grouping/outcome variables) set first.` };
  }
  return { eligible: true };
}

export function checkKruskalWallis(
  groupLabels: string[],
  groupedScores: Record<string, number[]>
): EligibilityResult {
  const validLabels = groupLabels.filter(label => (groupedScores[label]?.length ?? 0) >= 2);
  if (validLabels.length < 3) {
    return { eligible: false, reason: `Kruskal-Wallis needs >=3 groups with >=2 scores each; found ${validLabels.length}.` };
  }
  return { eligible: true };
}

export function checkTwoWayAnova(
  levelsA: unknown[],
  levelsB: unknown[],
  outcomeValues: number[]
): EligibilityResult {
  if (levelsA.length < 2 || levelsB.length < 2) {
    return { eligible: false, reason: 'Two-way ANOVA needs >=2 levels for each factor.' };
  }
  const minN = levelsA.length * levelsB.length + 1;
  if (outcomeValues.length < minN) {
    return { eligible: false, reason: `Two-way ANOVA needs n >= ${minN} for a ${levelsA.length}x${levelsB.length} design; have n=${outcomeValues.length}.` };
  }
  return { eligible: true };
}

export function checkMediation(
  predictorScores: number[] | undefined,
  mediatorScores: number[] | undefined,
  outcomeScores: number[] | undefined
): EligibilityResult {
  if (!predictorScores || !mediatorScores || !outcomeScores) {
    return { eligible: false, reason: 'Mediation needs predictor, mediator, and outcome constructs all configured.' };
  }
  const n = Math.min(predictorScores.length, mediatorScores.length, outcomeScores.length);
  if (n < 4) {
    return { eligible: false, reason: `Mediation needs n >= 4; have n=${n}.` };
  }
  return { eligible: true };
}

export function checkModeration(
  predictorScores: number[] | undefined,
  moderatorScores: number[] | undefined,
  outcomeScores: number[] | undefined
): EligibilityResult {
  if (!predictorScores || !moderatorScores || !outcomeScores) {
    return { eligible: false, reason: 'Moderation needs predictor, moderator, and outcome constructs all configured.' };
  }
  const n = Math.min(predictorScores.length, moderatorScores.length, outcomeScores.length);
  if (n < 4) {
    return { eligible: false, reason: `Moderation needs n >= 4; have n=${n}.` };
  }
  return { eligible: true };
}

export function checkChiSquare(session: any, rowLabels: string[], colLabels: string[]): EligibilityResult {
  if (!session.chisquare_config) {
    return { eligible: false, reason: 'Chi-square needs row and column categorical variables selected.' };
  }
  if (rowLabels.length < 2 || colLabels.length < 2) {
    return { eligible: false, reason: `Chi-square needs >=2 categories in each variable; found ${rowLabels.length} row and ${colLabels.length} column categories.` };
  }
  return { eligible: true };
}

export const TEST_NAMES = [
  'descriptive', 'correlation', 'regression', 'logistic', 'ttest', 'paired',
  'mannwhitney', 'wilcoxon', 'anova', 'kruskalwallis', 'twowayanova',
  'mediation', 'moderation', 'chisquare',
] as const;

export type TestName = typeof TEST_NAMES[number];
