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

async function readBody(req: Request): Promise<any> {
  try { return await req.json(); } catch (e) { return {}; }
}
const bad = (m: string, s: number = 400) => NextResponse.json({ error: m }, { status: s });

export async function GET(req: Request) {
  const g = await gate(req);
  if (g.err) return g.err;
  const { data, error } = await g.db.from("referral_rates").select("user_id,commission_percent,created_at").order("created_at", { ascending: false }).limit(200);
  if (error) return bad("Could not load ambassadors.", 500);
  const rows: any[] = data || [];
  const list = await Promise.all(rows.map(async (r: any) => {
    let email = "";
    try {
      const u = await g.db.auth.admin.getUserById(r.user_id);
      email = (u && u.data && u.data.user && u.data.user.email) || "";
    } catch (e) {}
    return { user_id: r.user_id, email, commission_percent: Number(r.commission_percent), created_at: r.created_at };
  }));
  return NextResponse.json({ rows: list });
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (g.err) return g.err;
  const b = await readBody(req);
  const email = String((b && b.email) || "").trim().toLowerCase();
  const pct = Number(b && b.percent);
  if (!email || email.length > 200 || email.indexOf("@") < 1) return bad("Enter a valid email address.");
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return bad("Enter a rate above 0 and up to 100.");
  const pat = email.replace(/[\\%_]/g, (m) => "\\" + m);
  const { data: found } = await g.db.from("profiles").select("id,email").ilike("email", pat).limit(5);
  const hit = ((found as any[]) || []).find((x: any) => String(x.email || "").toLowerCase() === email);
  if (!hit) return bad("No account with that email. They must sign up first.", 404);
  const { error } = await g.db.from("referral_rates").upsert({ user_id: hit.id, commission_percent: pct }, { onConflict: "user_id" });
  if (error) return bad("Could not save. Please try again.", 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = await gate(req);
  if (g.err) return g.err;
  const b = await readBody(req);
  const id = String((b && b.user_id) || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("Bad request.");
  const { error } = await g.db.from("referral_rates").delete().eq("user_id", id);
  if (error) return bad("Could not remove. Please try again.", 500);
  return NextResponse.json({ ok: true });
}
