import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/intronAuth";
import { getIntronStatus, verifyFileToken } from "@/lib/intronClient";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_JOBS_PER_CALL = 12;

type ItemOut = { fileId: string; state: string; transcript: string | null };

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.INTRON_API_KEY;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!apiKey || !secret) {
      return NextResponse.json({ error: "African-language transcription is not configured." }, { status: 500 });
    }
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const jobs = body && body.jobs;
    if (!Array.isArray(jobs) || jobs.length === 0 || jobs.length > MAX_JOBS_PER_CALL) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    for (const j of jobs) {
      if (!j || typeof j.fileId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(j.fileId) || typeof j.fileToken !== "string") {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
      }
    }

    let busyCount = 0;
    const items: ItemOut[] = await Promise.all(
      jobs.map(async (j: { fileId: string; fileToken: string }): Promise<ItemOut> => {
        if (!verifyFileToken(secret, user.id, j.fileId, j.fileToken)) {
          return { fileId: j.fileId, state: "error", transcript: null };
        }
        try {
          const r = await getIntronStatus(apiKey, j.fileId);
          return { fileId: j.fileId, state: r.state, transcript: r.transcript };
        } catch (err: any) {
          console.error("intron-status error:", err?.code || "", String(err?.message || "unknown").slice(0, 300));
          if (err && err.status === 429) {
            busyCount++;
            return { fileId: j.fileId, state: "processing", transcript: null };
          }
          return { fileId: j.fileId, state: "error", transcript: null };
        }
      })
    );
    if (busyCount === items.length) {
      return NextResponse.json({ error: "The service is busy. Please try again in a moment." }, { status: 429 });
    }
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("intron-status error:", err?.code || "", String(err?.message || "unknown").slice(0, 300));
    return NextResponse.json({ error: "Could not check transcription progress. Please try again." }, { status: 500 });
  }
}
