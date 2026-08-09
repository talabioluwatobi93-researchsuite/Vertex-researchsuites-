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

    const { data: existing } = await supabase
      .from("wallet_transactions")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: "Already credited", amount: amountInNaira });
    }

    const { data: wallet, error: fetchError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("id", userId)
      .single();

    if (fetchError || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    const newBalance = Number(wallet.balance) + amountInNaira;

    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update balance" }, { status: 500 });
    }

    await supabase.from("wallet_transactions").insert({
      user_id: userId,
      reference,
      amount: amountInNaira,
      status: "success",
    });

    return NextResponse.json({ message: "Wallet credited", newBalance });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
