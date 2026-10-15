import { NextResponse } from "next/server";
import { adminDb, requireUser, cleanCode } from "@/lib/referralServer";

export const maxDuration = 30;

// Links a new user to the person who invited them. Safe to call many times.
// The invite code is read from the account itself (saved at signup), never from the browser.
export async function POST(req: Request) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "Referrals are not configured." }, { status: 500 });
  const user = await requireUser(req, db);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const say = (status: string) => NextResponse.json({ status });
  try {
    const ref = cleanCode(user.meta && user.meta.ref_code);
    if (!ref) return say("none");
    const { data: mine } = await db.from("referrals").select("referrer_user_id").eq("referred_user_id", user.id).maybeSingle();
    if (mine) return say("already");
    const { data: owner } = await db.from("referral_codes").select("user_id").eq("code", ref).maybeSingle();
    if (!owner) return say("invalid");
    if (owner.user_id === user.id) return say("self");
    const { data: paid } = await db.from("wallet_transactions").select("id").eq("user_id", user.id).limit(1);
    if (paid && paid.length > 0) return say("has_deposit");
    const { error } = await db.from("referrals").insert({ referred_user_id: user.id, referrer_user_id: owner.user_id });
    if (error) {
      if (error.code === "23505") return say("already");
      console.error("referral link insert:", error.code || "", String(error.message || "").slice(0, 200));
      return NextResponse.json({ error: "Could not link your referral." }, { status: 500 });
    }
    return say("linked");
  } catch (e: any) {
    console.error("referral link error:", String((e && e.message) || "unknown").slice(0, 200));
    return NextResponse.json({ error: "Could not link your referral." }, { status: 500 });
  }
}
