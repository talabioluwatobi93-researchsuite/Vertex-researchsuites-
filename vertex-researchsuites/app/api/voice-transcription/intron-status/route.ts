import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/intronAuth";
import { getIntronStatus, verifyFileToken } from "@/lib/intronClient";

export const runtime = "nodejs";
export const maxDuration = 30;

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
    const fileId = body && body.fileId;
    const fileToken = body && body.fileToken;
    if (typeof fileId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(fileId) || typeof fileToken !== "string") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (!verifyFileToken(secret, user.id, fileId, fileToken)) {
      return NextResponse.json({ error: "This job does not belong to your account." }, { status: 403 });
    }

    const result = await getIntronStatus(apiKey, fileId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("intron-status error:", err?.code || "", String(err?.message || "unknown").slice(0, 300));
    if (err && err.status === 429) {
      return NextResponse.json({ error: "The service is busy. Please try again in a moment." }, { status: 429 });
    }
    return NextResponse.json({ error: "Could not check transcription progress. Please try again." }, { status: 500 });
  }
}
