// Starts Intron transcription for pieces that were cut at speaker changes (P12-3).
// One speaker per piece, Intron's own speaker labels off. A boundary marked "soft" (a cut inside one
// speaker's long turn) is moved to the quietest moment within +-3 s. Both neighbours compute the same
// move from the same numbers, so no audio is lost or doubled between them.
import { NextRequest, NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAdmin, requireUser } from "@/lib/intronAuth";
import { intronCodeFor } from "@/lib/intronLanguages";
import { isSafeAudioPath, isValidPart, signFileToken, startIntronJob } from "@/lib/intronClient";
import { findQuietCut } from "@/lib/intronCuts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PIECES_PER_CALL = 4;
const TIME_BUDGET_MS = 42000;
const MAX_TOTAL_SECONDS = 3700;
const ANALYSIS_RATE = 8000;
const SNAP_HALF_SECONDS = 3;
const RAW_MAX_SECONDS = 112;
const MIN_PIECE_SECONDS = 0.3;

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

type PieceIn = { index: number; startSeconds: number; endSeconds: number; softStart: boolean; softEnd: boolean };
type JobOut = { index: number; startSeconds: number; fileId?: string; fileToken?: string; error?: string; deferred?: boolean; weakCut?: boolean };

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
    const total = body && typeof body.totalSeconds === "number" ? body.totalSeconds : NaN;
    const rawPieces = body && body.pieces;
    if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 100 || !isSafeAudioPath(audioPath)) {
      return NextResponse.json({ error: "Invalid audio file." }, { status: 400 });
    }
    if (!Number.isFinite(total) || total <= 0 || total > MAX_TOTAL_SECONDS) {
      return NextResponse.json({ error: "Invalid audio length." }, { status: 400 });
    }
    if (!Array.isArray(rawPieces) || rawPieces.length === 0 || rawPieces.length > MAX_PIECES_PER_CALL) {
      return NextResponse.json({ error: "Invalid audio segments." }, { status: 400 });
    }
    const pieces: PieceIn[] = [];
    for (const rp of rawPieces) {
      const s = Number(rp && rp.startSeconds);
      const e = Number(rp && rp.endSeconds);
      const idx = Number(rp && rp.index);
      if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isInteger(idx) || idx < 0 || s < 0 || e <= s || e > total + 0.5 || e - s > RAW_MAX_SECONDS) {
        return NextResponse.json({ error: "Invalid audio segments." }, { status: 400 });
      }
      pieces.push({ index: idx, startSeconds: s, endSeconds: e, softStart: !!(rp && rp.softStart), softEnd: !!(rp && rp.softEnd) });
    }
    if (!code) return NextResponse.json({ error: "Please choose a supported language." }, { status: 400 });

    const t0 = Date.now();
    const admin = getAdmin();
    const { data: session } = await admin
      .from("voice_transcription_sessions").select("id,user_id,audio_path").eq("id", sessionId).single();
    if (!session || session.user_id !== user.id || session.audio_path !== audioPath) {
      return NextResponse.json({ error: "This audio does not belong to your account." }, { status: 403 });
    }
    const { data: fileData, error: downloadError } = await admin.storage.from("interview-audio").download(audioPath);
    if (downloadError || !fileData) return NextResponse.json({ error: "Could not download audio file." }, { status: 500 });
    const stamp = Date.now() + "-" + Math.floor(Math.random() * 1e6);
    const inputTmp = join(tmpdir(), "ipiece-in-" + stamp + ".audio");
    tmpFiles.push(inputTmp);
    await writeFile(inputTmp, Buffer.from(await fileData.arrayBuffer()));

    // Moves a mid-turn boundary to the quietest moment around it. Same input -> same answer.
    const snapped = new Map<number, { t: number; weak: boolean }>();
    const snap = async (t: number): Promise<{ t: number; weak: boolean }> => {
      const hit = snapped.get(t);
      if (hit) return hit;
      const ws = Math.max(0, t - SNAP_HALF_SECONDS);
      const we = Math.min(total, t + SNAP_HALF_SECONDS);
      let out = { t, weak: true };
      if (we - ws >= 1) {
        try {
          const found = findQuietCut(await decodeWindow(inputTmp, ws, we - ws), ANALYSIS_RATE);
          out = { t: Math.min(we, Math.max(ws, ws + found.offsetSeconds)), weak: found.weak };
        } catch {}
      }
      snapped.set(t, out);
      return out;
    };

    const jobs: JobOut[] = [];
    let busy = false;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (busy || Date.now() - t0 > TIME_BUDGET_MS) {
        jobs.push({ index: p.index, startSeconds: p.startSeconds, deferred: true });
        continue;
      }
      const outputTmp = join(tmpdir(), "ipiece-out-" + stamp + "-" + i + ".mp3");
      tmpFiles.push(outputTmp);
      try {
        let weak = false;
        let a = p.startSeconds;
        let b = p.endSeconds;
        if (p.softStart) { const r = await snap(a); a = r.t; if (r.weak) weak = true; }
        if (p.softEnd) { const r = await snap(b); b = r.t; if (r.weak) weak = true; }
        const dur = b - a;
        if (!(dur >= MIN_PIECE_SECONDS) || !isValidPart(a, dur)) {
          jobs.push({ index: p.index, startSeconds: p.startSeconds, error: "Could not start this part." });
          continue;
        }
        await runFfmpegExtract(inputTmp, outputTmp, a, dur);
        const partBuffer = await readFile(outputTmp);
        const job = await startIntronJob(apiKey, {
          blob: new Blob([partBuffer]),
          fileName: "part.mp3",
          languageCode: code,
          diarize: false,
        });
        jobs.push({ index: p.index, startSeconds: p.startSeconds, fileId: job.fileId, fileToken: signFileToken(secret, user.id, job.fileId), weakCut: weak });
      } catch (err: any) {
        console.error("intron-pieces part error:", err && err.code ? err.code : "", String((err && err.message) || "unknown").slice(0, 300));
        if (err && err.status === 429) {
          busy = true;
          jobs.push({ index: p.index, startSeconds: p.startSeconds, deferred: true });
        } else {
          jobs.push({ index: p.index, startSeconds: p.startSeconds, error: "Could not start this part." });
        }
      }
    }
    if (busy && !jobs.some((j) => j.fileId)) {
      return NextResponse.json({ error: "The service is busy. Please try again in a moment." }, { status: 429 });
    }
    return NextResponse.json({ jobs });
  } catch (err: any) {
    console.error("intron-pieces error:", err && err.code ? err.code : "", String((err && err.message) || "unknown").slice(0, 300));
    return NextResponse.json({ error: "Could not start transcription. Please try again." }, { status: 500 });
  } finally {
    for (const f of tmpFiles) { try { await unlink(f); } catch {} }
  }
}
