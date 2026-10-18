export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callQualCoderAChain } from '@/lib/openrouter';
import { requireSessionOwner } from '@/lib/qualAuth';
import { buildReferenceBlock, stripReferences } from '@/lib/qualReferences';
import {
  Assignment, ThemeDef, ThemeProse, buildCodebookTable, mentionCounts,
  assembleNarrative, agreementStatement, cleanProse, fallbackClaim,
} from '@/lib/qualReport';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const PROSE_TIMEOUT_MS = 25000;

function themePrompt(fw: any, theme: ThemeDef, mentions: number, percent: number, apa: string) {
  return `You are a qualitative research expert writing part of the Results chapter (Chapter 4) of a student's thesis. Strict APA ${apa} style, formal academic tone, no first person.

RESEARCH TOPIC: ${fw.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(fw.researchQuestions || [])}

THEME: "${theme.name}"
DEFINITION: ${theme.description || ''}
PARAGRAPHS CODED TO THIS THEME: ${mentions} (${percent}% of all theme mentions)

Return ONLY a JSON object with two string fields:
{"claim": "...", "synthesis": "..."}
"claim": ONE sentence stating what the data show for this theme, using the numbers above exactly.
"synthesis": 2 to 4 sentences interpreting the theme and tying it to the research questions.
Rules: Do NOT quote participants and do not put any quotation marks around words from the data (quotes are added separately by the system). Do not invent numbers. No markdown, no headings.`;
}

function contentPrompt(fw: any, table: any[], apa: string) {
  return `You are a qualitative research expert writing the Content Analysis part of the Results chapter (Chapter 4) of a student's thesis. Strict APA ${apa} style, formal academic tone, no first person.

RESEARCH TOPIC: ${fw.topic || 'N/A'}
THEME FREQUENCY TABLE (counts of coded paragraphs):
${JSON.stringify(table, null, 2)}

Discuss which themes were most and least prevalent and what that suggests.
Rules: Do not invent numbers. Do not quote participants. Maximum 8 lines. Plain text only, no markdown, no heading.`;
}

function synthesisPrompt(fw: any, names: string[]) {
  return `You are a qualitative research expert writing the closing paragraph of the Results chapter (Chapter 4) of a student's thesis. Formal academic tone, no first person.

RESEARCH TOPIC: ${fw.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(fw.researchQuestions || [])}
OBJECTIVES: ${JSON.stringify(fw.objectives || [])}
THEMES COVERED: ${names.join(', ')}

Write a brief closing paragraph synthesizing how these findings relate to the stated research questions and objectives.
Rules: Do not quote participants. Maximum 8 lines. Plain text only, no markdown, no heading.`;
}

function parseJson(raw: string): any {
  const t = String(raw || '').replace(/```json|```/g, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

async function ask(prompt: string): Promise<string | null> {
  try {
    const r = await callQualCoderAChain(prompt, PROSE_TIMEOUT_MS);
    return r.content || null;
  } catch (e: any) {
    if (String(e?.message || '').includes('CONFIG_ERROR')) throw e;
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId;
    const action = body.action;
    if (!sessionId || (action !== 'step' && action !== 'assemble' && action !== 'references')) {
      return NextResponse.json({ error: 'Missing sessionId or action' }, { status: 400 });
    }

    const own = await requireSessionOwner(
      req, supabase, sessionId,
      'themes, quote_assignments, analysis_type, research_framework, agreement, report_parts, results'
    );
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });
    const session = own.session;

    if (!session.agreement || session.agreement.decision !== 'proceed') {
      return NextResponse.json(
        { error: 'Please complete the coder agreement check before generating your report.' },
        { status: 403 }
      );
    }
    if (!session.themes || !session.quote_assignments) {
      return NextResponse.json({ error: 'Coded data not found. Please complete the earlier steps first.' }, { status: 404 });
    }

    const fw = session.research_framework || {};
    const themes: ThemeDef[] = session.themes || [];
    const assignments: Assignment[] = (session.quote_assignments || []).filter((a: Assignment) => !a.removed);
    const types: string[] = session.analysis_type || [];
    const apa = fw.apaVersion || '7th edition';
    const doThematic = types.includes('thematic');
    const doContent = types.includes('content');
    const labelsA = session.agreement.labelsA;
    const mc = mentionCounts(themes.map((t) => t.name), labelsA, assignments);
    const rows = buildCodebookTable(themes, mc.counts, mc.total);

    const steps: { kind: string; index?: number }[] = [];
    if (doThematic) themes.forEach((_, i) => steps.push({ kind: 'theme', index: i }));
    if (doContent) steps.push({ kind: 'content' });
    steps.push({ kind: 'synthesis' });

    const parts: any = session.report_parts && typeof session.report_parts === 'object'
      ? session.report_parts : {};
    if (!parts.themes) parts.themes = {};

    if (action === 'step') {
      const n = Number(body.n);
      if (!Number.isInteger(n) || n < 0 || n >= steps.length) {
        return NextResponse.json({ error: 'Bad step number' }, { status: 400 });
      }
      if (n === 0) { parts.themes = {}; parts.content = null; parts.synthesis = null; }
      const st = steps[n];
      let usedFallback = false;
      if (st.kind === 'theme') {
        const t = themes[st.index as number];
        const row = rows[st.index as number];
        const raw = await ask(themePrompt(fw, t, row.mentions, row.percent, apa));
        const j = raw ? parseJson(raw) : null;
        const claim = j ? cleanProse(j.claim) : null;
        const synthesis = j ? cleanProse(j.synthesis) : null;
        if (!claim || !synthesis) usedFallback = true;
        parts.themes[t.name] = { claim: claim || fallbackClaim(t.name, row.mentions, row.percent), synthesis };
      } else if (st.kind === 'content') {
        const table = rows.map((r) => ({ theme: r.theme, count: r.mentions, percent: r.percent }));
        const raw = await ask(contentPrompt(fw, table, apa));
        parts.content = cleanProse(raw);
        if (!parts.content) usedFallback = true;
      } else {
        const raw = await ask(synthesisPrompt(fw, themes.map((t) => t.name)));
        parts.synthesis = cleanProse(raw);
        if (!parts.synthesis) usedFallback = true;
      }
      await supabase.from('qualitative_analysis_sessions').update({ report_parts: parts }).eq('id', sessionId);
      return NextResponse.json({ step: n, stepCount: steps.length, done: n === steps.length - 1, usedFallback });
    }

    if (action === 'references') {
      const base: any = session.results
      if (!base || typeof base.narrative !== 'string') {
        return NextResponse.json({ error: 'Report not ready.' }, { status: 409 })
      }
      const style = /6/.test(String(fw.apaVersion || '')) ? 'APA6' : 'APA7'
      const block = await buildReferenceBlock({ topic: String(fw.topic || ''), style, narrative: base.narrative })
      const results2 = {
        ...base,
        narrative: stripReferences(base.narrative) + '\n' + block.lines.join('\n'),
        references: { fromYear: block.fromYear, shortfall: block.shortfall, flags: block.flags, computedAt: new Date().toISOString() },
      }
      await supabase.from('qualitative_analysis_sessions').update({ results: results2 }).eq('id', sessionId)
      return NextResponse.json({ results: results2 })
    }
    
    // action === 'assemble': code builds counts, quotes and tables; AI prose only fills gaps in wording
    const prose: Record<string, ThemeProse> = {};
    themes.forEach((t) => {
      const p = parts.themes[t.name];
      prose[t.name] = p ? { claim: p.claim || null, synthesis: p.synthesis || null } : { claim: null, synthesis: null };
    });
    const narrative = assembleNarrative({
      themes, rows, assignments, prose,
      includeThematic: doThematic,
      contentText: doContent ? parts.content || null : null,
      synthesisText: parts.synthesis || null,
      agreementText: agreementStatement(session.agreement),
    });

    const groupedQuotes: Record<string, string[]> = {};
    assignments.forEach((a) => {
      if (!groupedQuotes[a.theme]) groupedQuotes[a.theme] = [];
      groupedQuotes[a.theme].push(a.quote);
    });
    const results = {
      themeCount: themes.length,
      quoteCount: assignments.length,
      frequencyTable: doContent ? rows.map((r) => ({ theme: r.theme, count: r.mentions, percent: r.percent })) : null,
      groupedQuotes: doThematic ? groupedQuotes : null,
      codebookTable: rows,
      narrative,
      computedAt: new Date().toISOString(),
    };
    await supabase
      .from('qualitative_analysis_sessions')
      .update({ results, status: 'completed' })
      .eq('id', sessionId);
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: 'Report generation failed. Please try again.' }, { status: 500 });
  }
}
