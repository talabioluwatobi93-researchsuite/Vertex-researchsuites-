import { NextResponse } from "next/server";
import { adminDb, requireUser, makeCode } from "@/lib/referralServer";

export const maxDuration = 30;

// Returns this user's referral code, creating it the first time.
export async function POST(req: Request) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "Referrals are not configured." }, { status: 500 });
  const user = await requireUser(req, db);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    for (let i = 0; i < 5; i++) {
      const { data: have } = await db.from("referral_codes").select("code").eq("user_id", user.id).maybeSingle();
      if (have && have.code) return NextResponse.json({ code: have.code });
      const { error } = await db.from("referral_codes").insert({ user_id: user.id, code: makeCode() });
      if (error && error.code !== "23505") {
        console.error("referral code insert:", error.code || "", String(error.message || "").slice(0, 200));
        break;
      }
    }
  } catch (e: any) {
    console.error("referral code error:", String((e && e.message) || "unknown").slice(0, 200));
  }
  return NextResponse.json({ error: "Could not get your referral code. Please try again." }, { status: 500 });
}
