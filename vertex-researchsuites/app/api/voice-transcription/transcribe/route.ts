import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, audioPath } = await req.json();

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("interview-audio")
      .download(audioPath);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Could not download audio file." }, { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const audioBlob = new Blob([arrayBuffer]);

    const form = new FormData();
    form.append("file", audioBlob, "audio.mp3");
    form.append("model", "whisper-large-v3");
    form.append("response_format", "text");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      await supabaseAdmin.from("voice_transcription_sessions").update({ status: "failed" }).eq("id", sessionId);
      return NextResponse.json({ error: "Transcription failed. Please try again.", detail: errText }, { status: 500 });
    }

    const transcript = await groqRes.text();

    await supabaseAdmin
      .from("voice_transcription_sessions")
      .update({ raw_transcript: transcript, status: "transcribed", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return NextResponse.json({ transcript });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
