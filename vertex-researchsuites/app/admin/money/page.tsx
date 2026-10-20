"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type R = { feature: string; count: number; revenue: number; rev30: number; refunded: number; failed: number; open: number };

const naira = (n: number) => "\u20A6" + Number(n || 0).toLocaleString();

async function api(qs: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/overview?" + qs, { headers: { Authorization: "Bearer " + (session?.access_token || "") } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export default function AdminMoneyPage() {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("view=money").then(setD).catch((e: any) => setError(e.message || "Could not load."));
  }, []);

  const rows: R[] = d ? [...d.rows].sort((a: R, b: R) => b.revenue - a.revenue) : [];
  const tot = (k: keyof R) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
  const card = { flex: "1 1 140px", background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 12, padding: 12 } as const;
  const cards: [string, string][] = d ? [
    ["Purchase revenue", naira(tot("revenue"))],
    ["Last 30 days", naira(tot("rev30"))],
    ["Refunded", naira(tot("refunded"))],
    ["Failed runs", String(tot("failed"))],
    ["Open purchases", String(d.open)],
    ["Wallet balances (" + d.wallets + ")", naira(d.balances)],
    ["Withdrawals owed", naira(d.owed)],
  ] : [];

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: "#333333", fontSize: 22, fontWeight: 700, margin: 0 }}>Money</h1>
        <p style={{ color: "#777777", fontSize: 13 }}>Feature purchases only. Deposits are not shown here yet.</p>
        {error ? <p style={{ color: "#C0392B", fontSize: 14 }}>{error}</p> : null}
        {!d && !error ? <p style={{ color: "#777777" }}>Loading...</p> : null}
        {d && d.truncated ? <p style={{ color: "#B26A00", fontSize: 12 }}>Showing the latest 5,000 purchases only.</p> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "10px 0" }}>
          {cards.map(([l, v]) => (
            <div key={l} style={card}><div style={{ color: "#777777", fontSize: 12 }}>{l}</div><div style={{ color: "#333333", fontSize: 18, fontWeight: 700 }}>{v}</div></div>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.feature} style={{ background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 12, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ color: "#333333", fontSize: 14, fontWeight: 700 }}>{r.feature}</div>
              <div style={{ color: "#333333", fontSize: 14, fontWeight: 700 }}>{naira(r.revenue)}</div>
            </div>
            <div style={{ color: "#777777", fontSize: 12, marginTop: 4 }}>
              {r.count} purchases | 30d {naira(r.rev30)} | refunded {naira(r.refunded)} | failed {r.failed} | open {r.open}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
