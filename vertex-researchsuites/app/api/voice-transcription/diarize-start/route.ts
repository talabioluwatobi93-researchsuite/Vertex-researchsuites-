import { checkVoiceJob } from '@/lib/voiceGate'
// Starts speaker detection for ONE chunk (at most 15 min) of an uploaded recording.
// Flow: check user + session -> cut the chunk -> store it briefly -> signed link -> start the Replicate job.
import { NextRequest, NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAdmin, requireUser } from "@/lib/intronAuth";
import { isSafeAudioPath, signFileToken } from "@/lib/intronClient";
import { planDiarChunks } from "@/lib/diarizePlan";
import { startDiarization, ReplicateHttpError } from "@/lib/replicateClient";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOTAL_SECONDS = 3700;
const SESSION_RE = /^[A-Za-z0-9_-]{1,100}$/;
const BUCKET = "interview-audio";

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
  const tmpFiles: string[] = [];
  let chunkPath = "";
  let started = false;
  let adminRef: ReturnType<typeof getAdmin> | null = null;
  try {
    const repToken = process.env.REPLICATE_API_TOKEN;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!repToken || !secret) {
      return NextResponse.json({ error: "Speaker detection is not configured." }, { status: 500 });
    }
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const admin = getAdmin();
    adminRef = admin;

    const body = await req.json().catch(() => null);
    const sessionId = body && body.sessionId;
    const audioPath = body && body.audioPath;
    const total = body && typeof body.totalSeconds === "number" ? body.totalSeconds : NaN;
    const start = Number(body && body.startSeconds);
    const dur = Number(body && body.durationSeconds);
    if (typeof sessionId !== "string" || !SESSION_RE.test(sessionId) || !isSafeAudioPath(audioPath)) {
      return NextResponse.json({ error: "Invalid audio file." }, { status: 400 });
    }
    if (!Number.isFinite(total) || total <= 0 || total > MAX_TOTAL_SECONDS) {
      return NextResponse.json({ error: "Invalid audio length." }, { status: 400 });
    }
    const chunk = planDiarChunks(total).find(
      (c) => Math.abs(c.startSeconds - start) < 0.5 && Math.abs(c.durationSeconds - dur) < 0.5
    );
    if (!chunk) return NextResponse.json({ error: "Invalid audio segment." }, { status: 400 });
    let maxSpeakers: number | undefined;
    const raw = body && body.maxSpeakers;
    if (raw !== undefined && raw !== null && raw !== "") {
      const m = Number(raw);
      if (!Number.isInteger(m) || m < 1 || m > 8) return NextResponse.json({ error: "Invalid speaker count." }, { status: 400 });
      maxSpeakers = m;
    }

    const { data: session } = await admin
      .from("voice_transcription_sessions").select("id,user_id,audio_path").eq("id", sessionId).single();
    if (!session || session.user_id !== user.id || session.audio_path !== audioPath) {
      return NextResponse.json({ error: "This audio does not belong to your account." }, { status: 403 });
    }
    const gate1 = await checkVoiceJob(admin, user.id, sessionId, 'voice_african')
    if (!gate1.ok) return NextResponse.json({ error: gate1.error }, { status: gate1.status })
    const { data: fileData, error: downloadError } = await admin.storage.from(BUCKET).download(audioPath);
    if (downloadError || !fileData) return NextResponse.json({ error: "Could not download audio file." }, { status: 500 });

    const stamp = Date.now() + "-" + Math.floor(Math.random() * 1e6);
    const inputTmp = join(tmpdir(), "diar-in-" + stamp + ".audio");
    const outputTmp = join(tmpdir(), "diar-out-" + stamp + ".mp3");
    tmpFiles.push(inputTmp, outputTmp);
    await writeFile(inputTmp, Buffer.from(await fileData.arrayBuffer()));
    await runFfmpegExtract(inputTmp, outputTmp, chunk.startSeconds, chunk.durationSeconds);
    const chunkBuf = await readFile(outputTmp);

    chunkPath = "tmp-diar/" + sessionId + "/" + stamp + ".mp3";
    const up = await admin.storage.from(BUCKET).upload(chunkPath, chunkBuf, { contentType: "audio/mpeg", upsert: false });
    if (up.error) { chunkPath = ""; return NextResponse.json({ error: "Could not prepare audio." }, { status: 500 }); }
    const signed = await admin.storage.from(BUCKET).createSignedUrl(chunkPath, 3600);
    if (signed.error || !signed.data || !signed.data.signedUrl) {
      return NextResponse.json({ error: "Could not prepare audio." }, { status: 500 });
    }

    const job = await startDiarization(repToken, signed.data.signedUrl, maxSpeakers);
    started = true;
    return NextResponse.json({
      predictionId: job.id,
      token: signFileToken(secret, user.id, job.id),
      chunkPath,
      startSeconds: chunk.startSeconds,
      durationSeconds: chunk.durationSeconds,
    });
  } catch (err: any) {
    console.error("diarize-start error:", err && err.status ? err.status : "", String((err && err.message) || "unknown").slice(0, 200));
    if (err instanceof ReplicateHttpError) {
      if (err.status === 429) return NextResponse.json({ error: "The service is busy. Please try again in a moment." }, { status: 429 });
      if (err.status === 402) return NextResponse.json({ error: "Speaker detection is unavailable right now." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not start speaker detection." }, { status: 500 });
  } finally {
    if (chunkPath && !started && adminRef) { try { await adminRef.storage.from(BUCKET).remove([chunkPath]); } catch {} }
    for (const f of tmpFiles) { try { await unlink(f); } catch {} }
  }
}
