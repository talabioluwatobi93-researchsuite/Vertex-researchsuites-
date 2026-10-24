"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Row = { user_id: string; email: string; referred: number; deposited: number; earned: number; pending: number; paid: number; available: number; percent: number; ambassador: boolean };

const naira = (n: number) => "\u20A6" + Number(n || 0).toLocaleString();

async function api() {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/referrals", { headers: { Authorization: "Bearer " + (session?.access_token || "") } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ earned: 0, pending: 0, paid: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api();
      setRows(d.rows || []);
      setTotal(d.total || 0);
      if (d.totals) setTotals(d.totals);
    } catch (e: any) {
      setError(e.message || "Could not load.");
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const box = { backgroundColor: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 16, padding: 16, marginBottom: 12 };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#333333", marginBottom: 6 }}>Referrals and earnings</h1>
      <p style={{ fontSize: 13, color: "#777777", marginBottom: 16 }}>
        Everyone who has referred someone, with what they earned and what they have asked to withdraw.
      </p>
      {error && <p style={{ color: "#C0392B", fontSize: 13 }}>{error}</p>}
      {loading && <p style={{ color: "#777777", fontSize: 13 }}>Loading...</p>}
      {!loading && !error && rows.length === 0 && (
        <div style={box}><p style={{ color: "#777777", fontSize: 13, margin: 0 }}>No referrals yet.</p></div>
      )}
      {rows.length > 0 && (
        <div style={box}>
          <p style={{ color: "#333333", fontSize: 14, margin: 0 }}>{total} referrer(s). Total earned {naira(totals.earned)}</p>
          <p style={{ color: "#777777", fontSize: 12, margin: "4px 0 0" }}>
            Pending withdrawals {naira(totals.pending)}. Paid out {naira(totals.paid)}. Still available {naira(totals.available)}.
          </p>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.user_id} style={box}>
          <p style={{ color: "#333333", fontSize: 14, fontWeight: 700, margin: 0 }}>{r.email || "Unknown email"}</p>
          <p style={{ color: r.ambassador ? "#D4AF37" : "#777777", fontSize: 12, margin: "2px 0 8px" }}>
            {r.ambassador ? "Ambassador" : "Standard"}: {r.percent}% on first deposits
          </p>
          <p style={{ color: "#333333", fontSize: 13, margin: 0 }}>Referred {r.referred}. Deposited {r.deposited}.</p>
          <p style={{ color: "#333333", fontSize: 13, margin: "2px 0 0" }}>
            Earned {naira(r.earned)}. Pending {naira(r.pending)}. Paid {naira(r.paid)}. Available {naira(r.available)}.
          </p>
        </div>
      ))}
      {total > rows.length && <p style={{ color: "#777777", fontSize: 12 }}>Showing the top {rows.length} by earnings.</p>}
    </div>
  );
}
