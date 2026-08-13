import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

function runFfmpegExtract(inputPath: string, outputPath: string, startSeconds: number, durationSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath as string,
      ["-y", "-ss", String(startSeconds), "-t", String(durationSeconds), "-i", inputPath, "-ac", "1", "-ar", "16000", "-b:a", "64k", outputPath],
      (error) => {
        if (error) { reject(error); return; }
        resolve();
      }
    );
  });
}

export async function POST(req: NextRequest) {
  let inputTmp = "";
  let outputTmp = "";
  try {
    const { audioPath, startSeconds, durationSeconds } = await req.json();

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("interview-audio").download(audioPath);
    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Could not download audio file." }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const stamp = Date.now();
    inputTmp = join(tmpdir(), `chunk-in-${stamp}.audio`);
    outputTmp = join(tmpdir(), `chunk-out-${stamp}.mp3`);
    await writeFile(inputTmp, buffer);

    await runFfmpegExtract(inputTmp, outputTmp, startSeconds, durationSeconds);

    const chunkBuffer = await readFile(outputTmp);
    const chunkBlob = new Blob([chunkBuffer]);

    const form = new FormData();
    form.append("file", chunkBlob, "chunk.mp3");
    form.append("model", "whisper-large-v3");
    form.append("response_format", "text");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return NextResponse.json({ error: "Transcription failed for a segment. Please try again.", detail: errText }, { status: 500 });
    }

    const text = await groqRes.text();
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Something went wrong processing this segment." }, { status: 500 });
  } finally {
    if (inputTmp) { try { await unlink(inputTmp); } catch {} }
    if (outputTmp) { try { await unlink(outputTmp); } catch {} }
  }
}
