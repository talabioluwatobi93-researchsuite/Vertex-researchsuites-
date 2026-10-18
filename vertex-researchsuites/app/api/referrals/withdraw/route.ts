import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/referralServer";

export const maxDuration = 30;

const tidy = (v: unknown, max: number) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);

// Saves a withdrawal request as "pending". Nothing is paid here; the owner pays and marks it paid.
export async function POST(req: Request) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "Referrals are not configured." }, { status: 500 });
  const user = await requireUser(req, db);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }
  const name = tidy(body && body.account_name, 80);
  const bank = tidy(body && body.bank_name, 60);
  const number = tidy(body && body.account_number, 20).replace(/\s/g, "");
  if (name.length < 3 || bank.length < 2 || !/^\d{10}$/.test(number)) {
    return NextResponse.json({ error: "Please enter the account name, the bank, and a 10-digit account number." }, { status: 400 });
  }
  try {
    const { data, error } = await db.rpc("request_referral_withdrawal", { p_user: user.id, p_name: name, p_bank: bank, p_number: number });
    if (error) throw error;
    if (data && data.error === "closed") return NextResponse.json({ error: "Withdrawals are not open right now." }, { status: 403 });
    if (data && data.error === "below_minimum") return NextResponse.json({ error: "below_minimum", min: data.min, available: data.available }, { status: 400 });
    if (!data || !data.id) throw new Error("no id returned");
    return NextResponse.json({ status: "pending", amount: data.amount });
  } catch (e: any) {
    console.error("referral withdraw error:", String((e && (e.code || e.message)) || "unknown").slice(0, 200));
    return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 500 });
  }
}
