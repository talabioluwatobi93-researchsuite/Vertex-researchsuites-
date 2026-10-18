// Checks one speaker-detection job. Returns processing, failed, or the speaker segments (seconds, relative to the chunk).
// Voice fingerprints in the model output are dropped here and never leave the server.
import { NextRequest, NextResponse } from "next/server";
import { getAdmin, requireUser } from "@/lib/intronAuth";
import { verifyFileToken } from "@/lib/intronClient";
import { getPrediction, mapStatus, segmentsOf } from "@/lib/replicateClient";

export const runtime = "nodejs";
export const maxDuration = 30;

const SESSION_RE = /^[A-Za-z0-9_-]{1,100}$/;
const PRED_RE = /^[A-Za-z0-9]{1,64}$/;
const BUCKET = "interview-audio";

export async function POST(req: NextRequest) {
  try {
    const repToken = process.env.REPLICATE_API_TOKEN;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!repToken || !secret) {
      return NextResponse.json({ error: "Speaker detection is not configured." }, { status: 500 });
    }
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const sessionId = body && body.sessionId;
    const predictionId = body && body.predictionId;
    const jobToken = body && body.token;
    const chunkPath = body && body.chunkPath;
    if (typeof sessionId !== "string" || !SESSION_RE.test(sessionId) || typeof predictionId !== "string" || !PRED_RE.test(predictionId)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (typeof jobToken !== "string" || !verifyFileToken(secret, user.id, predictionId, jobToken)) {
      return NextResponse.json({ error: "This job does not belong to your account." }, { status: 403 });
    }

    const pred = await getPrediction(repToken, predictionId);
    const state = mapStatus(pred.status);
    if (state === "processing") return NextResponse.json({ state: "processing" });

    // Finished either way: delete the temporary chunk (only if it is this user's session folder).
    if (typeof chunkPath === "string" && new RegExp("^tmp-diar/" + sessionId + "/[0-9]{10,16}-[0-9]{1,7}\\.mp3$").test(chunkPath)) {
      try {
        const admin = getAdmin();
        const { data: session } = await admin.from("voice_transcription_sessions").select("id,user_id").eq("id", sessionId).single();
        if (session && session.user_id === user.id) await admin.storage.from(BUCKET).remove([chunkPath]);
      } catch {}
    }
    if (state === "failed") {
      console.error("diarize-status failed:", pred.error);
      return NextResponse.json({ state: "failed", error: "Speaker detection failed for this part." });
    }
    return NextResponse.json({ state: "done", segments: segmentsOf(pred.output) });
  } catch (err: any) {
    console.error("diarize-status error:", err && err.status ? err.status : "", String((err && err.message) || "unknown").slice(0, 200));
    return NextResponse.json({ error: "Could not check speaker detection." }, { status: 502 });
  }
}
