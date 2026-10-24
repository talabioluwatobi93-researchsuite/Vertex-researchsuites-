"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Row = {
  id: string; user_id: string; email: string; account_name: string; bank_name: string;
  account_number: string; amount: number; status: string; note: string | null;
  created_at: string; paid_at: string | null;
};

const naira = (n: number) => "\u20A6" + Number(n || 0).toLocaleString();
const when = (s: string | null) => (s ? new Date(s).toLocaleString() : "");

async function api(method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/withdrawals", {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session?.access_token || "") },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"pending" | "paid" | "all">("pending");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { const d = await api("GET"); setRows(d.rows || []); }
    catch (e: any) { setError(e.message || "Could not load."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markPaid(r: Row) {
    if (!window.confirm("Mark " + naira(r.amount) + " to " + r.account_name + " as paid? Do this only after the transfer is done.")) return;
    setBusy(r.id); setError("");
    try { await api("POST", { action: "paid", id: r.id }); await load(); }
    catch (e: any) { setError(e.message || "Could not update."); }
    setBusy("");
  }

  async function reject(r: Row) {
    const why = window.prompt("Reject " + naira(r.amount) + " for " + r.account_name + "? They will not be paid and the amount is released. Type a short reason:");
    if (why === null) return;
    setBusy(r.id); setError("");
    try { await api("POST", { action: "rejected", id: r.id, note: why }); await load(); }
    catch (e: any) { setError(e.message || "Could not update."); }
    setBusy("");
  }

  async function copy(v: string) {
    try { await navigator.clipboard.writeText(v); setCopied(v); setTimeout(() => setCopied(""), 1500); } catch {}
  }

  const pending = rows.filter((r) => r.status === "pending");
  const paid = rows.filter((r) => r.status === "paid");
  const owed = pending.reduce((s, r) => s + Number(r.amount || 0), 0);
  const paidTotal = paid.reduce((s, r) => s + Number(r.amount || 0), 0);
  const shown = tab === "all" ? rows : tab === "paid" ? paid : pending;
  const card = { flex: 1, background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 12, padding: 12 } as const;

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: "#333333", fontSize: 22, fontWeight: 700, margin: 0 }}>Withdrawals</h1>
        <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
          <div style={card}><div style={{ color: "#777777", fontSize: 12 }}>Still owed ({pending.length})</div><div style={{ color: "#333333", fontSize: 20, fontWeight: 700 }}>{naira(owed)}</div></div>
          <div style={card}><div style={{ color: "#777777", fontSize: 12 }}>Paid out ({paid.length})</div><div style={{ color: "#333333", fontSize: 20, fontWeight: 700 }}>{naira(paidTotal)}</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["pending", "paid", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #EEEEEE", background: tab === t ? "#D4AF37" : "#FFFFFF", color: tab === t ? "#FFFFFF" : "#333333", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {error ? <p style={{ color: "#C0392B", fontSize: 14 }}>{error}</p> : null}
        {loading ? <p style={{ color: "#777777" }}>Loading...</p> : null}
        {!loading && !error && shown.length === 0 ? <p style={{ color: "#777777", fontSize: 14 }}>Nothing here yet.</p> : null}
        {shown.map((r) => (
          <div key={r.id} style={{ background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ color: "#333333", fontSize: 16, fontWeight: 700 }}>{naira(r.amount)}</div>
              <div style={{ color: r.status === "paid" ? "#2E7D32" : "#B26A00", fontSize: 12, fontWeight: 700 }}>{r.status.toUpperCase()}</div>
            </div>
            <div style={{ color: "#333333", fontSize: 14, marginTop: 6 }}>{r.account_name} | {r.bank_name}</div>
            <div style={{ color: "#333333", fontSize: 14 }}>
              {r.account_number}{" "}
              <button onClick={() => copy(r.account_number)} style={{ border: "none", background: "none", color: "#D4AF37", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{copied === r.account_number ? "Copied" : "Copy"}</button>
            </div>
            <div style={{ color: "#777777", fontSize: 12, marginTop: 4 }}>{r.email} | Requested {when(r.created_at)}{r.paid_at ? " | Paid " + when(r.paid_at) : ""}</div>
            {r.note ? <div style={{ color: "#777777", fontSize: 12 }}>Note: {r.note}</div> : null}
            {r.status === "pending" ? (
              <button onClick={() => reject(r)} disabled={busy === r.id} style={{ marginTop: 10, marginRight: 8, padding: "9px 16px", borderRadius: 10, border: "1px solid #C0392B", background: "#FFFFFF", color: "#C0392B", fontWeight: 700, cursor: "pointer" }}>Reject</button>
            ) : null}
            {r.status === "pending" ? (
              <button onClick={() => markPaid(r)} disabled={busy === r.id} style={{ marginTop: 10, padding: "9px 16px", borderRadius: 10, border: "none", background: busy === r.id ? "#CCCCCC" : "#D4AF37", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{busy === r.id ? "Please wait..." : "Mark as paid"}</button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
