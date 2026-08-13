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
        reject(new Error("Could not determine audio duration."));
        return;
      }
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseFloat(match[3]);
      resolve(hours * 3600 + minutes * 60 + seconds);
    });
  });
}

export async function POST(req: NextRequest) {
  let tmpPath = "";
  try {
    const { audioPath } = await req.json();
    const { data: fileData, error } = await supabaseAdmin.storage.from("interview-audio").download(audioPath);
    if (error || !fileData) {
      return NextResponse.json({ error: "Could not download audio file." }, { status: 500 });
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    tmpPath = join(tmpdir(), `probe-${Date.now()}.audio`);
    await writeFile(tmpPath, buffer);
    const durationSeconds = await runFfmpegProbe(tmpPath);
    return NextResponse.json({ durationSeconds });
  } catch {
    return NextResponse.json({ error: "Could not determine audio duration." }, { status: 500 });
  } finally {
    if (tmpPath) {
      try { await unlink(tmpPath); } catch {}
    }
  }
}
