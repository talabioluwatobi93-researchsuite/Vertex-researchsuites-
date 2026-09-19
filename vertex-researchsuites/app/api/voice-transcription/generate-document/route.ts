import { NextRequest, NextResponse } from "next/server";
import { callVoiceInterpretChain } from "@/lib/openrouter";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { transcript, languageHint } = await req.json();

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json({ error: "No transcript provided." }, { status: 400 });
    }

    const hintLine = languageHint && languageHint.trim().length > 0
      ? `The speaker(s) mix the following languages/dialects: ${languageHint.trim()}. Use this to correctly interpret code-switched terms, phonetic spellings, and missing diacritics.`
      : `No specific language-mixing hint was provided; infer any code-switching from context.`;

    const prompt = `You are an advanced multilingual speech editor and linguist specializing in academic transcripts with code-switching, local dialects, and indigenous terms (e.g. Nigerian Pidgin, Yoruba, Igbo, Hausa mixed with English).

${hintLine}

Given the raw transcript below, produce a clean, publication-ready academic document with the following structure:

1. EXECUTIVE OVERVIEW: A short paragraph (3-5 sentences) summarizing what the recording covers, who is speaking (if identifiable from context), and the main topics discussed.

2. CORRECTED & FORMATTED TRANSCRIPT: Reproduce the full transcript, organized by topic or natural turn breaks using Markdown headers (##, ###). While doing this:
   - Correct obvious phonetic misspellings and restore missing diacritics (e.g. Yoruba tone marks) where confidently inferable from context.
   - Remove filler words (um, ah, uh) while preserving the speaker's meaning and tone.
   - Where a local/indigenous term or code-switched phrase appears, format it as: Original Text [Translation/Meaning].
   - Do not invent content that was not in the original transcript. If a word is unclear, mark it as [inaudible] rather than guessing.

3. KEY ENTITIES & METRICS: Bold any names, dates, places, numbers, or key terms mentioned, inline within the transcript above (do not create a separate list for this — bold them in place).

4. GLOSSARY: A 2-column Markdown table mapping every regional, indigenous, or technical term used in the transcript to its standard/English meaning. If no such terms appear, write "No regional or technical terms requiring glossary entries were identified."

Write the entire output in clear, professional academic English (except for direct quotes and glossary terms, which stay in the original language). Do not add commentary about your own process — output only the finished document.

RAW TRANSCRIPT:
${transcript}`;

    const result = await callVoiceInterpretChain(prompt);

    return NextResponse.json({ document: result.content, providerUsed: result.providerUsed });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Something went wrong generating the document. Please try again." },
      { status: 500 }
    );
  }
}
