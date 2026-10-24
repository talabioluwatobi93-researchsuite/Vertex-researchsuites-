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

function summarize(refs: any[], coms: any[], wds: any[], rates: any[], globalPct: number) {
  const m: Record<string, any> = {};
  const row = (id: string) => (m[id] = m[id] || { user_id: id, referred: 0, deposited: 0, earned: 0, pending: 0, paid: 0, percent: globalPct, ambassador: false });
  refs.forEach((r) => { row(r.referrer_user_id).referred += 1; });
  coms.forEach((c) => { const x = row(c.referrer_user_id); x.deposited += 1; x.earned += Number(c.amount || 0); });
  wds.forEach((w) => { const x = row(w.user_id); if (w.status === "pending") x.pending += Number(w.amount || 0); else if (w.status === "paid") x.paid += Number(w.amount || 0); });
  rates.forEach((r) => { const x = row(r.user_id); x.percent = Number(r.commission_percent); x.ambassador = true; });
  return Object.values(m).map((x: any) => ({ ...x, available: Math.max(0, x.earned - x.pending - x.paid) })).sort((a: any, b: any) => b.earned - a.earned);
}

async function all(db: any, table: string, cols: string): Promise<{ data: any[]; error: boolean }> {
  const out: any[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await db.from(table).select(cols).order("created_at", { ascending: true }).range(from, from + 999);
    if (error) return { data: out, error: true };
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { data: out, error: false };
}

export async function GET(req: Request) {
  const g = await gate(req);
  if (g.err) return g.err;
  const db = g.db;
  const [a, b, c, d, st] = await Promise.all([
    all(db, "referrals", "referrer_user_id"),
    all(db, "referral_commissions", "referrer_user_id,amount"),
    all(db, "referral_withdrawals", "user_id,amount,status"),
    db.from("referral_rates").select("user_id,commission_percent"),
    db.from("referral_settings").select("commission_percent").eq("id", 1).maybeSingle(),
  ]);
  if (a.error || b.error || c.error) return NextResponse.json({ error: "Could not load referrals." }, { status: 500 });
  const rows = summarize(a.data, b.data, c.data, (d.data as any[]) || [], Number(st.data && st.data.commission_percent) || 0);
  const totals = rows.reduce((t: any, r: any) => ({ earned: t.earned + r.earned, pending: t.pending + r.pending, paid: t.paid + r.paid, available: t.available + r.available }), { earned: 0, pending: 0, paid: 0, available: 0 });
  const shown = rows.slice(0, 100);
  await Promise.all(shown.map(async (r: any) => {
    r.email = "";
    try {
      const u = await db.auth.admin.getUserById(r.user_id);
      r.email = (u && u.data && u.data.user && u.data.user.email) || "";
    } catch (e) {}
  }));
  return NextResponse.json({ rows: shown, total: rows.length, totals });
}
