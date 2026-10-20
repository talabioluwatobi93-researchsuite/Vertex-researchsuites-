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
  const { data: rows, error } = await g.db
    .from("referral_withdrawals")
    .select("id,user_id,account_name,bank_name,account_number,amount,status,note,created_at,paid_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "Could not load withdrawals." }, { status: 500 });
  const list: any[] = rows || [];
  const ids = Array.from(new Set(list.map((r) => r.user_id))).slice(0, 100);
  const emails: Record<string, string> = {};
  await Promise.all(ids.map(async (id: any) => {
    try {
      const { data } = await g.db.auth.admin.getUserById(id);
      emails[id] = (data && data.user && data.user.email) || "";
    } catch {}
  }));
  return NextResponse.json({ rows: list.map((r) => ({ ...r, email: emails[r.user_id] || "" })) });
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (g.err) return g.err;
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }
  const id = String((body && body.id) || "");
  if (!id || !body || body.action !== "paid") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const upd: any = { status: "paid", paid_at: new Date().toISOString() };
  const note = String(body.note || "").trim().slice(0, 200);
  if (note) upd.note = note;
  const { data, error } = await g.db
    .from("referral_withdrawals")
    .update(upd)
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return NextResponse.json({ error: "Could not update." }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Already handled, or not found." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
