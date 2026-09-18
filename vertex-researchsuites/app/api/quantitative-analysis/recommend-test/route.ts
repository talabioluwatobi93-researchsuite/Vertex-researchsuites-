// CHUNK 1 — data-gathering layer
import { checkCorrelation, checkRegression, checkLogistic, checkConfigPresent,
         checkChiSquare, TEST_NAMES, TestName } from '../lib/eligibility';
import { callQuantRecommendChain } from '@/lib/openrouter';

interface ConstructProfile {
  id: string;
  name: string;
  type: 'scale' | 'categorical' | 'binary';
  n: number;
  isBinary?: boolean;
  uniqueCategories?: number;
  skew?: number;
}

interface DataProfile {
  constructs: ConstructProfile[];
  scaleConstructs: ConstructProfile[];
  categoricalConstructs: ConstructProfile[];
  binaryConstructs: ConstructProfile[];
  sampleSize: number;
  hasResearchFramework: boolean;
  researchText: string;
  configuredTests: TestName[];
  structurallyEligible: Partial<Record<TestName, { eligible: boolean; reason?: string }>>;
}

function buildDataProfile(session: any, constructScores: Record<string, number[]>): DataProfile {
  const constructs: ConstructProfile[] = (session.constructs || []).map((c: any) => {
    const scores = constructScores[c.id] || [];
    const unique = new Set(scores);
    const isBinary = scores.length > 0 && [...unique].every(v => v === 0 || v === 1);
    return {
      id: c.id,
      name: c.name,
      type: c.scaleType === 'categorical' ? 'categorical' : (isBinary ? 'binary' : 'scale'),
      n: scores.length,
      isBinary,
      uniqueCategories: c.scaleType === 'categorical' ? unique.size : undefined,
    };
  });

  const framework = session.research_framework || {};
  const researchText = [framework.topic, framework.researchQuestions, framework.hypotheses, framework.objectives]
    .filter(Boolean)
    .join('\n');

  const configuredTests = TEST_NAMES.filter(t => session[`${t}_config`] || t === 'descriptive');

  return {
    constructs,
    scaleConstructs: constructs.filter(c => c.type === 'scale'),
    categoricalConstructs: constructs.filter(c => c.type === 'categorical'),
    binaryConstructs: constructs.filter(c => c.isBinary),
    sampleSize: Math.max(0, ...constructs.map(c => c.n)),
    hasResearchFramework: !!(framework.researchQuestions || framework.hypotheses || framework.objectives),
    researchText,
    configuredTests,
    structurallyEligible: {},
  };
}

export { buildDataProfile };
export type { DataProfile, ConstructProfile };

// CHUNK 2 — rule-based structural scan (no AI, pure data facts)
import {
  checkCorrelation as _checkCorrelation,
  checkRegression as _checkRegression,
  checkLogistic as _checkLogistic,
  checkConfigPresent as _checkConfigPresent,
} from '../lib/eligibility';

function scanStructuralEligibility(session: any, profile: DataProfile, scores: Record<string, number[]>) {
  const result: Record<string, { eligible: boolean; reason?: string }> = {};

  result['correlation'] = _checkCorrelation(profile.scaleConstructs as any);
  result['regression'] = _checkRegression(session.ivConstructs || [], session.dvConstructs || [], scores);
  result['logistic'] = _checkLogistic(session.ivConstructs || [], session.dvConstructs || [], scores);

  const configTests: [string, string][] = [
    ['ttest', 'Independent-samples t-test'],
    ['paired', 'Paired-samples t-test'],
    ['mannwhitney', 'Mann-Whitney U test'],
    ['wilcoxon', 'Wilcoxon signed-rank test'],
    ['anova', 'One-way ANOVA'],
    ['kruskalwallis', 'Kruskal-Wallis test'],
    ['twowayanova', 'Two-way ANOVA'],
    ['mediation', 'Mediation analysis'],
    ['moderation', 'Moderation analysis'],
    ['chisquare', 'Chi-square test'],
  ];
  for (const [key, label] of configTests) {
    result[key] = _checkConfigPresent(session, `${key}_config`, label);
  }

  result['descriptive'] = { eligible: true };
  return result;
}

// CHUNK 3 — LLM-based intent mapping
async function callRecommendationLLM(profile: DataProfile) {
  const systemPrompt = `You are a research methodology expert. A researcher has described their study intent below. Based ONLY on the research text and the available constructs listed, suggest the appropriate statistical test(s) from this exact list: ${TEST_NAMES.join(', ')}.

Rules:
- Never invent a test not in the list.
- Never invent constructs not listed below.
- If the intent is unclear or doesn't map cleanly, say so honestly in your reasoning rather than forcing a guess.
- Consider mediation/moderation ONLY if the research text explicitly describes an indirect effect (mediation) or an interaction/conditional effect (moderation) — do not suggest these by default.
- In most cases a single test is correct. Suggest more than one ONLY when the research text describes multiple distinct hypotheses or objectives that each genuinely require a different test. Do not pad the list with tests that are not clearly supported by the text.

Available constructs:
${profile.constructs.map(c => `- ${c.name} (${c.type}, n=${c.n})`).join('\n')}

Research text:
"""
${profile.researchText || 'No research framework text provided.'}
"""

Respond with ONLY valid JSON, no markdown fences:
{ "suggestedTests": ["..."], "involvedConstructs": ["..."], "reasoning": "..." }`;

  const { content } = await callQuantRecommendChain(systemPrompt);
  const clean = content.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed.suggestedTests) && parsed.suggestedTest) {
    parsed.suggestedTests = [parsed.suggestedTest];
  }
  if (!Array.isArray(parsed.suggestedTests)) {
    parsed.suggestedTests = [];
  }
  return parsed;
}

// CHUNK 4 — combine rule-based scan + LLM suggestion into final output
function pickAppRecommendation(structural: Record<string, { eligible: boolean; reason?: string }>) {
  const priority = ['regression', 'logistic', 'correlation', 'anova', 'ttest', 'paired',
    'mannwhitney', 'wilcoxon', 'kruskalwallis', 'twowayanova', 'mediation', 'moderation',
    'chisquare', 'descriptive'];
  for (const test of priority) {
    if (structural[test]?.eligible) {
      return { test, reason: `Your data structurally supports ${test} (all required constructs and sample-size conditions are met).` };
    }
  }
  return { test: 'descriptive', reason: 'No inferential test is currently supported by your data configuration — descriptive statistics are available.' };
}

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return Response.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const { data: session, error } = await supabase
      .from('quantitative_analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // Build constructScores from raw_data + constructs the same way
    // calculate/route.ts does, via getConstructScore per row per construct.
    // NOTE: this assumes session.constructs and session.raw_data exist as
    // columns — confirm column names before running (see check below).
    const { getConstructScore } = await import('../calculate/route');
    const textMappings = session.cleaning_config?.text_mappings || {};
    const constructScores: Record<string, number[]> = {};
    for (const c of session.constructs || []) {
      constructScores[c.id] = (session.raw_data || [])
        .map((row: any[]) => getConstructScore(row, c, textMappings))
        .filter((v: number | null): v is number => v !== null);
    }

    const profile = buildDataProfile(session, constructScores || {});
    const structural = scanStructuralEligibility(session, profile, constructScores || {});
    profile.structurallyEligible = structural;

    const appRecommendation = pickAppRecommendation(structural);

    let userPlan = null;
    if (profile.hasResearchFramework) {
      const llmSuggestion = await callRecommendationLLM(profile);
      const suggestedTests: string[] = llmSuggestion.suggestedTests || [];
      const testPlans = suggestedTests.map((test: string) => {
        const validated = structural[test];
        return {
          suggestedTest: test,
          eligible: validated?.eligible ?? false,
          eligibilityNote: validated?.eligible
            ? 'Confirmed: your data supports this test.'
            : (validated?.reason || 'This test is not in the supported list.'),
        };
      });
      userPlan = {
        suggestedTest: testPlans[0]?.suggestedTest || '',
        suggestedTests: testPlans,
        involvedConstructs: llmSuggestion.involvedConstructs,
        reasoning: llmSuggestion.reasoning,
        eligible: testPlans[0]?.eligible ?? false,
        eligibilityNote: testPlans[0]?.eligibilityNote || '',
      };
    }

    return Response.json({ appRecommendation, userPlan, profile });
  } catch (err: any) {
    console.error('recommend-test error:', err);
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
