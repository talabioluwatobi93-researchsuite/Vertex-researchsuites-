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
  const { data, error } = await g.db.from("site_announcements").select("id,message,is_active,ends_at,updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load." }, { status: 500 });
  return NextResponse.json({ row: data || null });
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (g.err) return g.err;
  let b: any = null;
  try { b = await req.json(); } catch { b = null; }
  const message = String((b && b.message) || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (message.length > 300) return NextResponse.json({ error: "Message is too long (max 300)." }, { status: 400 });
  const isActive = !!(b && b.is_active);
  if (isActive && !message) return NextResponse.json({ error: "Type a message before showing it." }, { status: 400 });
  let endsAt: string | null = null;
  if (b && b.ends_at) {
    const d = new Date(String(b.ends_at));
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Bad end date." }, { status: 400 });
    endsAt = d.toISOString();
  }
  const { data: cur } = await g.db.from("site_announcements").select("id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!cur) return NextResponse.json({ error: "Announcement row missing." }, { status: 404 });
  const { error } = await g.db.from("site_announcements").update({ message, is_active: isActive, ends_at: endsAt, updated_at: new Date().toISOString() }).eq("id", cur.id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
