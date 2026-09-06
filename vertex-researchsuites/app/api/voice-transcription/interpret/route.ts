export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { callVoiceInterpretChain } from "@/lib/openrouter"

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    const prompt = `You are an experienced qualitative research analyst. Below is a raw interview transcript. Produce detailed interpretive notes for academic qualitative analysis. Identify:
1. Key themes with supporting quotes (verbatim from the transcript)
2. Notable contradictions or tensions in what the interviewee said
3. Emotional tone/emphasis where evident from word choice
4. Any gaps or points that would benefit from follow-up

Do not omit any theme present in the transcript, however minor. Write in clear, professional academic English.

Transcript:
${transcript}`;

    let notes: string
    try {
      const result = await callVoiceInterpretChain(prompt)
      notes = result.content
    } catch (err: any) {
      return NextResponse.json({ notes: err.message || "Something went wrong generating interpretive notes. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ notes: "Something went wrong generating interpretive notes. Please try again." }, { status: 500 });
  }
}
