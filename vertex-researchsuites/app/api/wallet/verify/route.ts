import { awardFirstDepositCommission } from "@/lib/referral";
import { adminDb } from "@/lib/referralServer";
import { creditTopup } from "@/lib/walletCredit";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reference, userId } = await req.json();

    if (!reference || !userId) {
      return NextResponse.json({ error: "Missing reference or userId" }, { status: 400 });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const data = await response.json();

    if (!data.status || data.data.status !== "success") {
      return NextResponse.json({ error: "Payment not successful" }, { status: 400 });
    }

    const amountInNaira = data.data.amount / 100;

    const metaUserId = data.data && data.data.metadata ? data.data.metadata.userId : null;
    if (metaUserId && metaUserId !== userId) {
      return NextResponse.json({ error: "Payment does not belong to this user" }, { status: 403 });
    }

    const result = await creditTopup(userId, reference, amountInNaira);
    if (result.status === "already_credited") {
      return NextResponse.json({ message: "Already credited", amount: amountInNaira });
    }
    if (result.status === "wallet_not_found") {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }
    if (result.status !== "credited") {
      return NextResponse.json({ error: "Failed to credit wallet" }, { status: 500 });
    }

    return NextResponse.json({ message: "Wallet credited", newBalance: result.balanceAfter });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
