export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { callVoiceInterpretChain } from '@/lib/openrouter';

function splitTranscript(transcript: string, chunkCount: number): string[] {
  const words = transcript.split(/\s+/);
  const perChunk = Math.ceil(words.length / chunkCount);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += perChunk) {
    chunks.push(words.slice(i, i + perChunk).join(' '));
  }
  return chunks.filter((c) => c.trim().length > 0);
}

function buildOverviewPrompt(transcript: string, hintLine: string) {
  return `You are an advanced multilingual speech editor and linguist. ${hintLine}

Given the raw transcript below, write ONLY a short EXECUTIVE OVERVIEW: a paragraph of 3-5 sentences summarizing what the recording covers, who is speaking (if identifiable from context), and the main topics discussed.

Do not add a heading, do not add commentary. Output only the paragraph.

RAW TRANSCRIPT:
${transcript}`;
}

function buildChunkPrompt(chunk: string, chunkIndex: number, totalChunks: number, hintLine: string) {
  return `You are an advanced multilingual speech editor and linguist specializing in academic transcripts with code-switching, local dialects, and indigenous terms (e.g. Nigerian Pidgin, Yoruba, Igbo, Hausa mixed with English). ${hintLine}

This is PART ${chunkIndex + 1} of ${totalChunks} of a longer raw transcript. Produce a clean, corrected, publication-ready version of ONLY this part, following these rules:
- Correct obvious phonetic misspellings and restore missing diacritics (e.g. Yoruba tone marks) where confidently inferable from context.
- Remove filler words (um, ah, uh) while preserving the speaker's meaning and tone.
- Where a local/indigenous term or code-switched phrase appears, format it as: Original Text [Translation/Meaning].
- Bold any names, dates, places, numbers, or key terms mentioned, inline (do not create a separate list, bold them in place).
- Do not invent content that was not in the original transcript. If a word is unclear, mark it as [inaudible] rather than guessing.
- Use Markdown headers (##, ###) only if a clear topic/turn break occurs within this part.

Output only the corrected transcript text for this part, no preamble, no commentary about your process.

RAW TRANSCRIPT PART ${chunkIndex + 1}:
${chunk}`;
}

function buildGlossaryPrompt(transcript: string, hintLine: string) {
  return `You are an advanced multilingual linguist. ${hintLine}

Given the raw transcript below, produce ONLY a 2-column Markdown table (GLOSSARY) mapping every regional, indigenous, or technical term used in the transcript to its standard/English meaning. If no such terms appear, output exactly: "No regional or technical terms requiring glossary entries were identified."

Output only the table (or the fallback sentence), no heading, no other commentary.

RAW TRANSCRIPT:
${transcript}`;
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, languageHint } = await req.json();

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'No transcript provided.' }, { status: 400 });
    }

    const hintLine = languageHint && languageHint.trim().length > 0
      ? `The speaker(s) mix the following languages/dialects: ${languageHint.trim()}. Use this to correctly interpret code-switched terms, phonetic spellings, and missing diacritics.`
      : `No specific language-mixing hint was provided; infer any code-switching from context.`;

    const words = transcript.split(/\s+/).length;
    const chunkCount = words > 1200 ? 4 : words > 600 ? 3 : words > 250 ? 2 : 1;
    const chunks = splitTranscript(transcript, chunkCount);

    try {
      const overviewPromise = callVoiceInterpretChain(buildOverviewPrompt(transcript, hintLine))
        .then((r) => ({ key: 'overview', text: (r.content || '').trim(), providerUsed: r.providerUsed }));

      const chunkPromises = chunks.map((chunk, idx) =>
        callVoiceInterpretChain(buildChunkPrompt(chunk, idx, chunks.length, hintLine))
          .then((r) => ({ key: `chunk:${idx}`, text: (r.content || '').trim() }))
      );

      const glossaryPromise = callVoiceInterpretChain(buildGlossaryPrompt(transcript, hintLine))
        .then((r) => ({ key: 'glossary', text: (r.content || '').trim() }));

      const settled = await Promise.all([overviewPromise, ...chunkPromises, glossaryPromise]);

      const overview = settled.find((s) => s.key === 'overview');
      const glossary = settled.find((s) => s.key === 'glossary');
      const chunkTexts = chunks.map((_, idx) => settled.find((s) => s.key === `chunk:${idx}`)?.text || '').join('\n\n');

      const document = `1. EXECUTIVE OVERVIEW\n${overview?.text || ''}\n\n2. CORRECTED & FORMATTED TRANSCRIPT\n${chunkTexts}\n\n3. GLOSSARY\n${glossary?.text || ''}`;

      const providerUsed = (overview as any)?.providerUsed || 'chunked';

      return NextResponse.json({ document, providerUsed });
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || 'Something went wrong generating the document. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Something went wrong generating the document. Please try again.' },
      { status: 500 }
    );
  }
}
