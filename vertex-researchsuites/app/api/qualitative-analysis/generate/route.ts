export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callQualStep2Chain } from '@/lib/openrouter';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

function buildThemePrompt(framework: any, theme: any, quotes: string[], researchType: string, apaVersion: string) {
  return `You are a qualitative research expert writing part of the Results chapter (Chapter 4) of a student's academic thesis/dissertation, presenting a Thematic Analysis section. Use strict APA ${apaVersion} style, formal academic tone, no first person, no AI-sounding phrases.

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(framework.researchQuestions || [])}

Write ONLY the discussion for this ONE theme: "${theme.name}"
Supporting quotes for this theme (student-reviewed and confirmed - use exactly as given, do not alter the quotes):
${JSON.stringify(quotes, null, 2)}

Present this theme with a short introduction, then weave in the supporting quotes naturally (quoted directly, attributed generically e.g. "as one respondent noted"), tying it back to the research questions/objectives.

Rules: Do not invent any quotes not provided above. Maximum 8 lines of output. Plain text only, no markdown formatting, no bullet points, no heading (the heading will be added separately).`;
}

function buildContentAnalysisPrompt(framework: any, frequencyTable: any[], apaVersion: string) {
  return `You are a qualitative research expert writing part of the Results chapter (Chapter 4) of a student's academic thesis/dissertation, presenting a Content Analysis section. Use strict APA ${apaVersion} style, formal academic tone, no first person.

RESEARCH TOPIC: ${framework.topic || 'N/A'}

THEME FREQUENCY TABLE:
${JSON.stringify(frequencyTable, null, 2)}

Write a discussion presenting this frequency table narratively, discussing which themes were most/least prevalent and what that suggests.

Rules: Do not invent frequency numbers not provided above. Maximum 8 lines of output. Plain text only, no markdown formatting, no heading.`;
}

function buildSynthesisPrompt(framework: any, themeNames: string[]) {
  return `You are a qualitative research expert writing the closing paragraph of the Results chapter (Chapter 4) of a student's academic thesis/dissertation. Formal academic tone, no first person.

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(framework.researchQuestions || [])}
OBJECTIVES: ${JSON.stringify(framework.objectives || [])}
THEMES COVERED: ${themeNames.join(', ')}

Write a brief closing paragraph synthesizing how these findings relate to the stated research questions and objectives.

Rules: Maximum 8 lines of output. Plain text only, no markdown formatting, no heading.`;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const { data: session, error } = await supabase
      .from('qualitative_analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session || !session.quote_assignments || !session.themes) {
      return NextResponse.json({ error: 'Coded data not found. Please complete Step 4 first.' }, { status: 404 });
    }

    const framework = session.research_framework || {};
    const themes: any[] = session.themes || [];
    const assignments: any[] = session.quote_assignments || [];
    const analysisTypes: string[] = session.analysis_type || [];
    const apaVersion = framework.apaVersion || '7th edition';

    const frequency: Record<string, number> = {};
    themes.forEach((t) => { frequency[t.name] = 0; });
    assignments.forEach((a) => { if (frequency[a.theme] !== undefined) frequency[a.theme]++; });
    const totalQuotes = assignments.length;
    const frequencyTable = Object.entries(frequency).map(([theme, count]) => ({
      theme, count, percent: totalQuotes > 0 ? Math.round((count / totalQuotes) * 10000) / 100 : 0,
    }));

    const groupedQuotes: Record<string, string[]> = {};
    assignments.forEach((a) => {
      if (!groupedQuotes[a.theme]) groupedQuotes[a.theme] = [];
      groupedQuotes[a.theme].push(a.quote);
    });

    try {
      const parts: { key: string; text: string }[] = [];
      const promises: Promise<{ key: string; text: string }>[] = [];

      if (analysisTypes.includes('thematic')) {
        themes.forEach((theme) => {
          const quotes = groupedQuotes[theme.name] || [];
          promises.push(
            callQualStep2Chain(buildThemePrompt(framework, theme, quotes, 'thematic', apaVersion))
              .then((r) => ({ key: `theme:${theme.name}`, text: (r.content || '').trim() }))
          );
        });
      }

      if (analysisTypes.includes('content')) {
        promises.push(
          callQualStep2Chain(buildContentAnalysisPrompt(framework, frequencyTable, apaVersion))
            .then((r) => ({ key: 'content', text: (r.content || '').trim() }))
        );
      }

      promises.push(
        callQualStep2Chain(buildSynthesisPrompt(framework, themes.map((t) => t.name)))
          .then((r) => ({ key: 'synthesis', text: (r.content || '').trim() }))
      );

      const settled = await Promise.all(promises);

      const narrativeParts: string[] = [];
      themes.forEach((theme) => {
        const found = settled.find((s) => s.key === `theme:${theme.name}`);
        if (found) narrativeParts.push(found.text);
      });
      const contentPart = settled.find((s) => s.key === 'content');
      if (contentPart) narrativeParts.push(contentPart.text);
      const synthesisPart = settled.find((s) => s.key === 'synthesis');
      if (synthesisPart) narrativeParts.push(synthesisPart.text);

      const narrative = 'Methodological Framework: Inductive Thematic Analysis adhering to Braun & Clarke (2006) protocol.\n\n' + narrativeParts.join('\n\n');

      const results = {
        themeCount: themes.length,
        quoteCount: assignments.length,
        frequencyTable: analysisTypes.includes('content') ? frequencyTable : null,
        groupedQuotes: analysisTypes.includes('thematic') ? groupedQuotes : null,
        narrative,
        computedAt: new Date().toISOString(),
      };

      await supabase
        .from('qualitative_analysis_sessions')
        .update({ results, status: 'completed' })
        .eq('id', sessionId);

      return NextResponse.json({ results });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Report generation failed.' }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Report generation failed.' }, { status: 500 });
  }
}
