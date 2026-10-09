import { NextRequest, NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAdmin, requireUser } from "@/lib/intronAuth";
import { intronCodeFor } from "@/lib/intronLanguages";
import { isSafeAudioPath, isValidPart, signFileToken, startIntronJob } from "@/lib/intronClient";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const apiKey = process.env.INTRON_API_KEY;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!apiKey || !secret) {
      return NextResponse.json({ error: "African-language transcription is not configured." }, { status: 500 });
    }
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const sessionId = body && body.sessionId;
    const audioPath = body && body.audioPath;
    const start = Number(body && body.startSeconds);
    const dur = Number(body && body.durationSeconds);
    const code = body && typeof body.language === "string" ? intronCodeFor(body.language) : null;
    const diarize = !(body && body.diarize === false);

    if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 100 || !isSafeAudioPath(audioPath)) {
      return NextResponse.json({ error: "Invalid audio file." }, { status: 400 });
    }
    if (!isValidPart(start, dur)) return NextResponse.json({ error: "Invalid audio segment." }, { status: 400 });
    if (!code) return NextResponse.json({ error: "Please choose a supported language." }, { status: 400 });

    const admin = getAdmin();
    const { data: session } = await admin
      .from("voice_transcription_sessions")
      .select("id,user_id,audio_path")
      .eq("id", sessionId)
      .single();
    if (!session || session.user_id !== user.id || session.audio_path !== audioPath) {
      return NextResponse.json({ error: "This audio does not belong to your account." }, { status: 403 });
    }

    const { data: fileData, error: downloadError } = await admin.storage.from("interview-audio").download(audioPath);
    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Could not download audio file." }, { status: 500 });
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const stamp = Date.now();
    inputTmp = join(tmpdir(), "ipart-in-" + stamp + ".audio");
    outputTmp = join(tmpdir(), "ipart-out-" + stamp + ".mp3");
    await writeFile(inputTmp, buffer);
    await runFfmpegExtract(inputTmp, outputTmp, start, dur);
    const partBuffer = await readFile(outputTmp);

    const job = await startIntronJob(apiKey, {
      blob: new Blob([partBuffer]),
      fileName: "part.mp3",
      languageCode: code,
      diarize,
    });
    return NextResponse.json({ fileId: job.fileId, fileToken: signFileToken(secret, user.id, job.fileId) });
  } catch (err: any) {
    console.error("intron-start error:", err?.code || "", String(err?.message || "unknown").slice(0, 300));
    if (err && err.status === 429) {
      return NextResponse.json({ error: "The service is busy. Please try again in a moment." }, { status: 429 });
    }
    return NextResponse.json({ error: "Could not start transcription for this segment. Please try again." }, { status: 500 });
  } finally {
    if (inputTmp) { try { await unlink(inputTmp); } catch {} }
    if (outputTmp) { try { await unlink(outputTmp); } catch {} }
  }
}
