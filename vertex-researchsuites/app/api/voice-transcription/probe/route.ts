import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

function runFfmpegProbe(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath as string, ["-i", filePath], (_error, _stdout, stderr) => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (!match) {
        reject(new Error("ffmpeg gave no duration: " + String(stderr || (_error as any)?.message || "").slice(0, 300)));
        return;
      }
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseFloat(match[3]);
      resolve(hours * 3600 + minutes * 60 + seconds);
    });
  });
}

// Decodes the whole file to find its true length. Raw .aac files have no length
// in their header, so ffmpeg only guesses from the file size. Returns 0 if it fails.
function runFfmpegDecodedDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      ffmpegPath as string,
      ["-nostdin", "-i", filePath, "-vn", "-f", "null", "-"],
      { timeout: 40000, maxBuffer: 8 * 1024 * 1024 },
      (_error, _stdout, stderr) => {
        const all = String(stderr || "").match(/time=(\d+):(\d+):(\d+\.\d+)/g);
        if (!all || all.length === 0) { resolve(0); return; }
        const m = /time=(\d+):(\d+):(\d+\.\d+)/.exec(all[all.length - 1]);
        if (!m) { resolve(0); return; }
        resolve(parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]));
      }
    );
  });
}

export async function POST(req: NextRequest) {
  let tmpPath = "";
  try {
    const { audioPath } = await req.json();
    const { data: fileData, error } = await supabaseAdmin.storage.from("interview-audio").download(audioPath);
    if (error || !fileData) {
      console.error("probe download failed:", error?.message || "no data");
      return NextResponse.json({ error: "Could not download audio file." }, { status: 500 });
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    tmpPath = join(tmpdir(), `probe-${Date.now()}.audio`);
    await writeFile(tmpPath, buffer);
    const headerSeconds = await runFfmpegProbe(tmpPath);
    const decodedSeconds = await runFfmpegDecodedDuration(tmpPath);
    const durationSeconds = Math.max(headerSeconds, decodedSeconds);
    return NextResponse.json({ durationSeconds });
  } catch (err: any) {
    console.error("probe error:", err?.code || "", err?.message || "unknown", "| ffmpeg path:", String(ffmpegPath));
    return NextResponse.json({ error: "Could not determine audio duration." }, { status: 500 });
  } finally {
    if (tmpPath) {
      try { await unlink(tmpPath); } catch {}
    }
  }
}
