import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHUNK_LENGTH_SECONDS = 600;

function getDurationSeconds(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath as string, ["-i", inputPath], (_error, _stdout, stderr) => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (!match) { reject(new Error("Could not read audio duration.")); return; }
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseFloat(match[3]);
      resolve(hours * 3600 + minutes * 60 + seconds);
    });
  });
}

function extractChunk(inputPath: string, outputPath: string, startSeconds: number, durationSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath as string,
      ["-y", "-ss", String(startSeconds), "-t", String(durationSeconds), "-i", inputPath, "-ac", "1", "-ar", "16000", "-b:a", "64k", outputPath],
      (error) => { if (error) { reject(error); return; } resolve(); }
    );
  });
}

async function transcribeChunkBuffer(buffer: Buffer): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), "chunk.mp3");
  form.append("model", "whisper-large-v3");
  form.append("response_format", "text");

  const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });

  if (!groqRes.ok) throw new Error(await groqRes.text());
  return groqRes.text();
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: NextRequest) {
  let inputTmp = "";
  try {
    const { userId, audioUrl } = await req.json();

    if (!userId || !audioUrl) {
      return NextResponse.json({ error: "Missing userId or audioUrl." }, { status: 400 });
    }

    let audioRes: Response;
    try {
      audioRes = await fetch(audioUrl);
    } catch {
      return NextResponse.json({ error: "Could not reach that audio link. Check the URL and try again." }, { status: 400 });
    }

    if (!audioRes.ok) {
      return NextResponse.json({ error: "That link did not return a valid file. Check the URL and try again." }, { status: 400 });
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const path = `${userId}/${Date.now()}-from-url.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage.from("interview-audio").upload(path, buffer);
    if (uploadError) {
      return NextResponse.json({ error: "Could not save the audio file. Please try again." }, { status: 500 });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("voice_transcription_sessions")
      .insert({ user_id: userId, audio_path: path, status: "uploaded", fee_charged: false })
      .select()
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Could not create transcription session. Please try again." }, { status: 500 });
    }

    inputTmp = join(tmpdir(), `url-in-${session.id}.audio`);
    await writeFile(inputTmp, buffer);

    let durationSeconds: number;
    try {
      durationSeconds = await getDurationSeconds(inputTmp);
    } catch {
      await supabaseAdmin.from("voice_transcription_sessions").update({ status: "failed" }).eq("id", session.id);
      return NextResponse.json({ error: "Could not read the audio file. Please check the link and try again." }, { status: 500 });
    }

    let accumulated = "";
    let start = 0;
    while (start < durationSeconds) {
      const chunkDuration = Math.min(CHUNK_LENGTH_SECONDS, durationSeconds - start);
      const outputTmp = join(tmpdir(), `url-chunk-${session.id}-${start}.mp3`);
      try {
        await extractChunk(inputTmp, outputTmp, start, chunkDuration);
        const chunkBuffer = await readFile(outputTmp);
        const text = await transcribeChunkBuffer(chunkBuffer);
        accumulated += (accumulated ? " " : "") + text.trim();
      } catch (err: any) {
        await supabaseAdmin.from("voice_transcription_sessions").update({ status: "failed" }).eq("id", session.id);
        return NextResponse.json({ error: "Transcription failed on part of the audio. Please try again.", detail: err.message }, { status: 500 });
      } finally {
        try { await unlink(outputTmp); } catch {}
      }
      start += CHUNK_LENGTH_SECONDS;
    }

    await supabaseAdmin
      .from("voice_transcription_sessions")
      .update({ raw_transcript: accumulated, status: "transcribed", updated_at: new Date().toISOString() })
      .eq("id", session.id);

    return NextResponse.json({ transcript: accumulated, sessionId: session.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Something went wrong. Please try again." }, { status: 500 });
  } finally {
    if (inputTmp) { try { await unlink(inputTmp); } catch {} }
  }
}
