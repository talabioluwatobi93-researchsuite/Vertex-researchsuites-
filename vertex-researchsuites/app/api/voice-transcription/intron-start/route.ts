import { NextRequest, NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAdmin, requireUser } from "@/lib/intronAuth";
import { intronCodeFor } from "@/lib/intronLanguages";
import {
  isSafeAudioPath,
  isValidPart,
  signFileToken,
  startIntronJob,
} from "@/lib/intronClient";
import {
  CUT_MAX_PART_SECONDS,
  CUT_STEP_SECONDS,
  cutWindow,
  findQuietCut,
  partCountFor,
  partRange,
} from "@/lib/intronCuts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PARTS_PER_CALL = 4;
const TIME_BUDGET_MS = 42000;
const MAX_TOTAL_SECONDS = 3700;
const ANALYSIS_RATE = 8000;

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

// Decodes a short window to mono 8 kHz signed 16-bit samples, in memory.
function decodeWindow(inputPath: string, startSeconds: number, lengthSeconds: number): Promise<Int16Array> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath as string,
      ["-v", "error", "-ss", String(startSeconds), "-t", String(lengthSeconds), "-i", inputPath, "-ac", "1", "-ar", String(ANALYSIS_RATE), "-f", "s16le", "pipe:1"],
      { encoding: "buffer", maxBuffer: 8 * 1024 * 1024, timeout: 20000 },
      (error, stdout) => {
        if (error) { reject(error); return; }
        const buf = stdout as Buffer;
        const even = buf.length - (buf.length % 2);
        const copy = new Uint8Array(even);
        copy.set(buf.subarray(0, even));
        resolve(new Int16Array(copy.buffer));
      }
    );
  });
}

type JobOut = { startSeconds: number; fileId?: string; fileToken?: string; error?: string; deferred?: boolean; weakCut?: boolean };

export async function POST(req: NextRequest) {
  const tmpFiles: string[] = [];
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
    const code = body && typeof body.language === "string" ? intronCodeFor(body.language) : null;
    const diarize = !(body && body.diarize === false);
    const rawParts = body && body.parts;
    const totalSeconds = body && typeof body.totalSeconds === "number" ? body.totalSeconds : NaN;

    if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 100 || !isSafeAudioPath(audioPath)) {
      return NextResponse.json({ error: "Invalid audio file." }, { status: 400 });
    }
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0 || totalSeconds > MAX_TOTAL_SECONDS) {
      return NextResponse.json({ error: "Invalid audio length." }, { status: 400 });
    }
    if (!Array.isArray(rawParts) || rawParts.length === 0 || rawParts.length > MAX_PARTS_PER_CALL) {
      return NextResponse.json({ error: "Invalid audio segments." }, { status: 400 });
    }
    const count = partCountFor(totalSeconds);
    const parts: { startSeconds: number; durationSeconds: number; index: number }[] = [];
    for (const rp of rawParts) {
      const s = Number(rp && rp.startSeconds);
      const d = Number(rp && rp.durationSeconds);
      if (!isValidPart(s, d)) return NextResponse.json({ error: "Invalid audio segments." }, { status: 400 });
      const index = Math.round(s / CUT_STEP_SECONDS);
      if (Math.abs(s - index * CUT_STEP_SECONDS) > 0.5 || index < 0 || index >= count) {
        return NextResponse.json({ error: "Invalid audio segments." }, { status: 400 });
      }
      parts.push({ startSeconds: s, durationSeconds: d, index });
    }
    if (!code) return NextResponse.json({ error: "Please choose a supported language." }, { status: 400 });

    const t0 = Date.now();
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
    const stamp = Date.now() + "-" + Math.floor(Math.random() * 1e6);
    const inputTmp = join(tmpdir(), "ipart-in-" + stamp + ".audio");
    tmpFiles.push(inputTmp);
    await writeFile(inputTmp, Buffer.from(await fileData.arrayBuffer()));

    // Quiet-cut offsets, found once per boundary per request.
    const cuts = new Map<number, { offsetSeconds: number; weak: boolean }>();
    const boundary = async (k: number) => {
      const hit = cuts.get(k);
      if (hit) return hit;
      const w = cutWindow(k, totalSeconds);
      const samples = await decodeWindow(inputTmp, w.startSeconds, w.lengthSeconds);
      const found = findQuietCut(samples, ANALYSIS_RATE);
      cuts.set(k, found);
      return found;
    };

    const jobs: JobOut[] = [];
    let busy = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (busy || Date.now() - t0 > TIME_BUDGET_MS) {
        jobs.push({ startSeconds: p.startSeconds, deferred: true });
        continue;
      }
      const outputTmp = join(tmpdir(), "ipart-out-" + stamp + "-" + i + ".mp3");
      tmpFiles.push(outputTmp);
      try {
        let weak = false;
        for (const k of [p.index, p.index + 1]) {
          if (k >= 1 && k < count) {
            const b = await boundary(k);
            if (b.weak) weak = true;
          }
        }
        const range = partRange(p.index, totalSeconds, (k) => {
          const c = cuts.get(k);
          return c ? c.offsetSeconds : 0;
        });
        if (!(range.durationSeconds > 0) || range.durationSeconds > CUT_MAX_PART_SECONDS + 0.5) {
          jobs.push({ startSeconds: p.startSeconds, error: "Could not start this part." });
          continue;
        }
        await runFfmpegExtract(inputTmp, outputTmp, range.startSeconds, range.durationSeconds);
        const partBuffer = await readFile(outputTmp);
        const job = await startIntronJob(apiKey, {
          blob: new Blob([partBuffer]),
          fileName: "part.mp3",
          languageCode: code,
          diarize,
        });
        jobs.push({ startSeconds: p.startSeconds, fileId: job.fileId, fileToken: signFileToken(secret, user.id, job.fileId), weakCut: weak });
      } catch (err: any) {
        console.error("intron-start part error:", err?.code || "", String(err?.message || "unknown").slice(0, 300));
        if (err && err.status === 429) {
          busy = true;
          jobs.push({ startSeconds: p.startSeconds, deferred: true });
        } else {
          jobs.push({ startSeconds: p.startSeconds, error: "Could not start this part." });
        }
      }
    }
    if (busy && !jobs.some((j) => j.fileId)) {
      return NextResponse.json({ error: "The service is busy. Please try again in a moment." }, { status: 429 });
    }
    return NextResponse.json({ jobs });
  } catch (err: any) {
    console.error("intron-start error:", err?.code || "", String(err?.message || "unknown").slice(0, 300));
    return NextResponse.json({ error: "Could not start transcription. Please try again." }, { status: 500 });
  } finally {
    for (const f of tmpFiles) {
      try { await unlink(f); } catch {}
    }
  }
}
