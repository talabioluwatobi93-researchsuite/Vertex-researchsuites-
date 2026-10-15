// Referral commission rule. Nothing is hardcoded: the percent and the
// minimum come from the referral_settings row. Never throws, so a
// referral problem can never break a wallet credit.

export type RefSettings = { commission_percent: number; min_qualifying_deposit: number };

export function commissionFor(deposit: number, s: RefSettings): number {
  const d = Number(deposit);
  const p = Number(s.commission_percent);
  const min = Number(s.min_qualifying_deposit) || 0;
  if (!Number.isFinite(d) || !Number.isFinite(p) || d <= 0 || p <= 0) return 0;
  if (d < min) return 0;
  return Math.round(d * p) / 100;
}

// Pays the referrer once, on the referred user's FIRST deposit only.
// The unique key on referral_commissions.referred_user_id makes a second
// payment impossible, even if the webhook and verify routes run together.
export async function awardFirstDepositCommission(
  db: any,
  userId: string,
  reference: string,
  amount: number
): Promise<string> {
  try {
    if (!userId || !reference) return "skipped";
    const { data: link } = await db
      .from("referrals")
      .select("referrer_user_id")
      .eq("referred_user_id", userId)
      .maybeSingle();
    if (!link) return "no_referrer";
    const { data: others } = await db
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", userId)
      .neq("reference", reference)
      .limit(1);
    if (others && others.length > 0) return "not_first_deposit";
    const { data: s } = await db
      .from("referral_settings")
      .select("commission_percent,min_qualifying_deposit")
      .eq("id", 1)
      .maybeSingle();
    if (!s) return "no_settings";
    const amt = commissionFor(amount, s);
    if (!(amt > 0)) return "below_minimum";
    const { error } = await db.from("referral_commissions").insert({
      referred_user_id: userId,
      referrer_user_id: link.referrer_user_id,
      deposit_reference: reference,
      deposit_amount: amount,
      percent_used: Number(s.commission_percent),
      amount: amt,
    });
    if (error) {
      if (error.code === "23505") return "already_paid";
      console.error("referral commission insert failed:", error.code || "", String(error.message || "").slice(0, 200));
      return "error";
    }
    return "awarded";
  } catch (e: any) {
    console.error("referral commission error:", String((e && e.message) || "unknown").slice(0, 200));
    return "error";
  }
}
