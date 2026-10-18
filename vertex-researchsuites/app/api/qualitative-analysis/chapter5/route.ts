export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQualChapter5Chain } from '@/lib/openrouter'
import { requireSessionOwner } from '@/lib/qualAuth'
import { gatherSources, sourceListForPrompt, applyCitations, stripUnmarkedCitations, buildReferenceList, citationCheckNote, styleFromApaVersion, SOURCES_NOTE } from '@/lib/qualChapter5Sources'
import type { GatherResult } from '@/lib/qualChapter5Sources'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    const own = await requireSessionOwner(req, supabase, sessionId, 'results, research_framework, chapter5_inputs, agreement, themes')
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status })
    const session = own.session
    if (!session.results) return NextResponse.json({ error: 'Results not found. Please complete your main analysis first.' }, { status: 404 })
    if (!session.agreement || session.agreement.decision !== 'proceed') {
      return NextResponse.json({ error: 'Please complete the coder agreement check before generating your report.' }, { status: 403 })
    }

    if (!session.chapter5_inputs) return NextResponse.json({ error: 'Missing Chapter 5 inputs.' }, { status: 400 })

    const framework = session.research_framework || {}
    const inputs = session.chapter5_inputs
    const apaVersion = framework.apaVersion || '7th edition'

    const themeNames: string[] = (session.themes || []).map((t: any) => (t && t.name) || '').filter(Boolean)
    const style = styleFromApaVersion(apaVersion)
    const found: GatherResult = await Promise.race([
      gatherSources(framework.topic || '', themeNames),
      new Promise<GatherResult>((resolve) => setTimeout(() => resolve({ sources: [], fromYear: null, note: 'The source search took too long, so this chapter cites none.' }), 12000)),
    ])
    const sourceRules = found.sources.length > 0
      ? '\n\nVERIFIED SOURCES (the only sources you may cite):\n' + sourceListForPrompt(found.sources) +
        '\nCITATION RULES: To cite, write only the marker, for example [S1], at the end of a sentence. Never write an author name or a year yourself. Cite a source only where its title directly supports a general point, and never describe what a source found, because you have not read it. Use each source at most twice. Do not add a reference list; it is added automatically.'
      : '\n\nNo verified sources are available. Do not cite any source and do not write any author or year. Do not add a reference list.'
    const prompt = `You are a research methodology expert writing Chapter 5 (Summary, Conclusion, and Recommendations) of a student's academic thesis/dissertation based on a qualitative study, following the standard departmental format. Use strict APA ${apaVersion} style, formal academic tone, no first person, no AI-sounding phrases.

RESEARCH TOPIC: ${framework.topic || 'N/A'}
RESEARCH QUESTIONS: ${JSON.stringify(framework.researchQuestions || [])}
OBJECTIVES: ${JSON.stringify(framework.objectives || [])}

PROBLEM STATEMENT (student-provided): ${inputs.problemStatement}
METHODOLOGY (student-provided): ${inputs.methodology}
LIMITATIONS (student-provided): ${inputs.limitations}

RESULTS (already generated, use as factual basis, do not invent findings not present here): ${JSON.stringify(session.results, null, 2)}

Write Chapter 5 with exactly these five sections, each with a clear heading on its own line:
5.1 Introduction
5.2 Summary
5.3 Conclusion
5.4 Limitations
5.5 Recommendations
5.5.1 Recommendations based on findings
5.5.2 Recommendations for further studies

Rules: Do not invent quotes or themes not present in the Results above. Output plain text only, no markdown, no bullet points.${sourceRules}`

    let chapter5_content: string
    try {
      const result = await callQualChapter5Chain(prompt)
      chapter5_content = result.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Chapter 5 generation failed' }, { status: 500 })
    }

    const stripped = stripUnmarkedCitations(chapter5_content)
    const applied = applyCitations(stripped.text, found.sources)
    const refLines = buildReferenceList(found.sources, applied.usedIds, style)
    const checkNote = citationCheckNote(stripped.removed, stripped.narrativeFlags, applied.unknownMarkers)
    const tail: string[] = []
    if (refLines.length > 0) { tail.push('References'); for (const l of refLines) tail.push(l); tail.push(SOURCES_NOTE) }
    else if (found.note) tail.push(found.note)
    if (checkNote) tail.push(checkNote)
    chapter5_content = applied.text.trim() + (tail.length ? '\n\n' + tail.join('\n') : '')
    const chapter5ReadyAt = new Date().toISOString()
    await supabase.from('qualitative_analysis_sessions').update({ chapter5_content, chapter5_paid: true, chapter5_ready_at: chapter5ReadyAt, chapter5_revealed: false, chapter5_inputs: { ...inputs, sources: found.sources } }).eq('id', sessionId)
    return NextResponse.json({ chapter5_content, chapter5_ready_at: chapter5ReadyAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chapter 5 generation failed' }, { status: 500 })
  }
}
