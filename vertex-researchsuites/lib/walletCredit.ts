import { adminDb } from "@/lib/referralServer";
import { awardFirstDepositCommission } from "@/lib/referral";

export type TopupStatus =
  | "credited"
  | "already_credited"
  | "wallet_not_found"
  | "invalid"
  | "error";

export type TopupResult = {
  status: TopupStatus;
  balanceBefore: number | null;
  balanceAfter: number | null;
};

const KNOWN: TopupStatus[] = [
  "credited",
  "already_credited",
  "wallet_not_found",
  "invalid",
];

function naira(n: number): string {
  return "\u20A6" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// One shared top-up credit step, used by the webhook and by verify.
// The database function claims the reference first, so a repeat or a
// race can never credit twice.
export async function creditTopup(
  userId: string,
  reference: string,
  amountInNaira: number
): Promise<TopupResult> {
  const failed: TopupResult = {
    status: "error",
    balanceBefore: null,
    balanceAfter: null,
  };
  try {
    const db = adminDb();
    const { data, error } = await db.rpc("credit_wallet_topup", {
      p_user_id: userId,
      p_reference: reference,
      p_amount: amountInNaira,
    });
    if (error) {
      console.error(
        "credit_wallet_topup failed:",
        error.code || "",
        String(error.message || "").slice(0, 200)
      );
      return failed;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const raw = row && row.out_result ? String(row.out_result) : "";
    const status = KNOWN.find((s) => s === raw);
    if (!status) {
      console.error("credit_wallet_topup returned an unexpected result");
      return failed;
    }
    const before = row.out_before == null ? null : Number(row.out_before);
    const after = row.out_after == null ? null : Number(row.out_after);
    if (status !== "credited") {
      return { status, balanceBefore: before, balanceAfter: after };
    }

    // The wallet is already credited. Nothing below may undo that.
    try {
      await awardFirstDepositCommission(db, userId, reference, amountInNaira);
    } catch (e: any) {
      console.error("commission step error:", String((e && e.message) || "unknown").slice(0, 200));
    }
    try {
      if (after !== null) {
        const { error: nErr } = await db.from("notifications").insert({
          user_id: userId,
          type: "topup",
          title: "Wallet funded",
          body: naira(amountInNaira) + " received. New balance " + naira(after) + ".",
          reference,
        });
        if (nErr && nErr.code !== "23505") {
          console.error("topup notification failed:", nErr.code || "", String(nErr.message || "").slice(0, 200));
        }
      }
    } catch (e: any) {
      console.error("notification step error:", String((e && e.message) || "unknown").slice(0, 200));
    }
    return { status, balanceBefore: before, balanceAfter: after };
  } catch (e: any) {
    console.error("creditTopup error:", String((e && e.message) || "unknown").slice(0, 200));
    return failed;
  }
}
