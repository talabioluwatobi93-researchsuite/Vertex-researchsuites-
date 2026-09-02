export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const notes = data.content?.[0]?.text || "Could not generate interpretive notes at this time.";

    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ notes: "Something went wrong generating interpretive notes. Please try again." }, { status: 500 });
  }
}
