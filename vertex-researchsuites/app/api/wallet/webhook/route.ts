import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest("hex");

  const signature = req.headers.get("x-paystack-signature");
  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const { reference, amount, metadata } = event.data;
    const userId = metadata?.userId;
    const amountInNaira = amount / 100;

    if (userId) {
      const { data: existing } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("reference", reference)
        .maybeSingle();

      if (!existing) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("id", userId)
          .single();

        if (wallet) {
          await supabase
            .from("wallets")
            .update({ balance: Number(wallet.balance) + amountInNaira })
            .eq("id", userId);

          await supabase.from("wallet_transactions").insert({
            user_id: userId,
            reference,
            amount: amountInNaira,
            status: "success",
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
