import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/referralServer";

export const maxDuration = 30;

async function gate(req: Request): Promise<{ db: any; err: NextResponse | null }> {
  const fail = (m: string, s: number) => ({ db: null as any, err: NextResponse.json({ error: m }, { status: s }) });
  const db = adminDb();
  if (!db) return fail("Not configured.", 500);
  const user = await requireUser(req, db);
  if (!user) return fail("Please sign in again.", 401);
  const { data } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) return fail("Access denied.", 403);
  return { db, err: null };
}

export async function GET(req: Request) {
  const g = await gate(req);
  if (g.err) return g.err;
  const { data, error } = await g.db.from("feature_pricing").select("feature_name,price").order("feature_name");
  if (error) return NextResponse.json({ error: "Could not load prices." }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (g.err) return g.err;
  let b: any = null;
  try { b = await req.json(); } catch { b = null; }
  const name = String((b && b.feature_name) || "");
  const price = Number(b && b.price);
  if (!name || !Number.isInteger(price) || price < 0 || price > 1000000) {
    return NextResponse.json({ error: "Enter a whole number from 0 to 1,000,000." }, { status: 400 });
  }
  if (name === "voice_transcription" && price > 0) {
    return NextResponse.json({ error: "This old key must stay 0. Use the per-minute rows." }, { status: 400 });
  }
  const { data, error } = await g.db.from("feature_pricing").update({ price }).eq("feature_name", name).select("feature_name,price");
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Price row not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: data[0] });
}
