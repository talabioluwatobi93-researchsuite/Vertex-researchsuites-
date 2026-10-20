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
  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  if (view === "users") return users(g.db, Math.max(1, Number(url.searchParams.get("page")) || 1));
  if (view === "money") return money(g.db);
  return NextResponse.json({ error: "Bad request." }, { status: 400 });
}

async function users(db: any, page: number) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) return NextResponse.json({ error: "Could not load users." }, { status: 500 });
  const list: any[] = (data && data.users) || [];
  const ids = list.map((u) => u.id);
  const bal: Record<string, number> = {};
  if (ids.length) {
    const { data: w } = await db.from("wallets").select("id,balance").in("id", ids);
    (w || []).forEach((x: any) => { bal[x.id] = Number(x.balance || 0); });
  }
  return NextResponse.json({
    page,
    more: list.length === 200,
    users: list.map((u) => ({ id: u.id, email: u.email || "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null, balance: bal[u.id] ?? 0 })),
  });
}

async function money(db: any) {
  const { data: jobs, error } = await db
    .from("feature_jobs")
    .select("feature,amount,status,ever_failed,refunded_at,created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ error: "Could not load purchases." }, { status: 500 });
  const since = Date.now() - 30 * 86400000;
  const per: Record<string, any> = {};
  let open = 0;
  (jobs || []).forEach((j: any) => {
    const p = per[j.feature] || (per[j.feature] = { feature: j.feature, count: 0, revenue: 0, rev30: 0, refunded: 0, failed: 0, open: 0 });
    const amt = Number(j.amount || 0);
    p.count++;
    if (j.refunded_at) p.refunded += amt;
    else { p.revenue += amt; if (new Date(j.created_at).getTime() >= since) p.rev30 += amt; }
    if (j.ever_failed) p.failed++;
    if (j.status === "open") { p.open++; open++; }
  });
  const { data: w } = await db.from("wallets").select("balance").limit(10000);
  const { data: wd } = await db.from("referral_withdrawals").select("amount").eq("status", "pending");
  const sum = (a: any[], k: string) => (a || []).reduce((s, x) => s + Number(x[k] || 0), 0);
  return NextResponse.json({
    rows: Object.values(per),
    open,
    wallets: (w || []).length,
    balances: sum(w || [], "balance"),
    owed: sum(wd || [], "amount"),
    truncated: (jobs || []).length >= 5000,
  });
}
