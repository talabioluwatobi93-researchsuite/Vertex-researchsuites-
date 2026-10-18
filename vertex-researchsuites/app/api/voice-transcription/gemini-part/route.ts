import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribePart } from "@/lib/geminiTranscribe";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// Gemini allows at most 30 minutes per request when speaker labels are on.
const MAX_PART_SECONDS = 30 * 60;

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
    const { audioPath, startSeconds, durationSeconds, languageCodes } = await req.json();

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Voice transcription is not configured." }, { status: 500 });
    }
    if (
      typeof audioPath !== "string" ||
      audioPath.length === 0 ||
      audioPath.length > 400 ||
      /[\u0000-\u001f\\]/.test(audioPath) ||
      audioPath.includes("..") ||
      audioPath.startsWith("/")
    ) {
      return NextResponse.json({ error: "Invalid audio file." }, { status: 400 });
    }
    const start = Number(startSeconds);
    const dur = Number(durationSeconds);
    if (!isFinite(start) || start < 0 || !isFinite(dur) || dur <= 0 || dur > MAX_PART_SECONDS) {
      return NextResponse.json({ error: "Invalid audio segment." }, { status: 400 });
    }
    const codes: string[] = Array.isArray(languageCodes)
      ? languageCodes.filter((c: unknown) => typeof c === "string" && /^[A-Za-z0-9-]{2,16}$/.test(c as string)).slice(0, 5)
      : [];

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("interview-audio").download(audioPath);
    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Could not download audio file." }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const stamp = Date.now();
    inputTmp = join(tmpdir(), `gpart-in-${stamp}.audio`);
    outputTmp = join(tmpdir(), `gpart-out-${stamp}.mp3`);
    await writeFile(inputTmp, buffer);

    await runFfmpegExtract(inputTmp, outputTmp, start, dur);

    const partBuffer = await readFile(outputTmp);
    const partBlob = new Blob([partBuffer]);

    const result = await transcribePart(key, partBlob, "audio/mp3", { languageCodes: codes, apiRevision: process.env.GEMINI_API_REVISION || undefined });
    return NextResponse.json({ words: result.words, text: result.text });
  } catch (err: any) {
    console.error("gemini-part error:", err?.code || "", err?.message || "unknown", "| ffmpeg path:", String(ffmpegPath));
    return NextResponse.json({ error: "Transcription failed for this segment. Please try again." }, { status: 500 });
  } finally {
    if (inputTmp) { try { await unlink(inputTmp); } catch {} }
    if (outputTmp) { try { await unlink(outputTmp); } catch {} }
  }
}
