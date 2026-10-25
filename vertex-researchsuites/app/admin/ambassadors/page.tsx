"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from '@/lib/supabase';


type Row = { user_id: string; email: string; commission_percent: number };

async function api(method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/ambassadors", {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session?.access_token || "") },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #EEEEEE", fontSize: 14, color: "#333333", boxSizing: "border-box" as const };

export default function AdminAmbassadorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [percent, setPercent] = useState("25");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api("GET");
      setRows(d.rows || []);
    } catch (e: any) {
      setError(e.message || "Could not load.");
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    setError(""); setMsg(""); setBusy(true);
    try {
      await api("POST", { email: email.trim(), percent: Number(percent) });
      setMsg("Ambassador saved.");
      setEmail("");
      await load();
    } catch (e: any) {
      setError(e.message || "Could not save.");
    }
    setBusy(false);
  }

  async function remove(id: string, label: string) {
    if (!window.confirm("Remove " + (label || "this person") + " as an ambassador? They go back to the normal rate.")) return;
    setError(""); setMsg(""); setBusy(true);
    try {
      await api("DELETE", { user_id: id });
      setMsg("Ambassador removed.");
      await load();
    } catch (e: any) {
      setError(e.message || "Could not remove.");
    }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#333333", marginBottom: 6 }}>Ambassadors</h1>
      <p style={{ fontSize: 13, color: "#777777", marginBottom: 16 }}>
        An ambassador earns their own rate on each referral&apos;s first deposit. Everyone else earns the normal rate.
      </p>
      <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ambassador email" style={{ ...inp, marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" style={{ ...inp, width: 90 }} />
          <span style={{ color: "#777777", fontSize: 13 }}>% of their referral&apos;s first deposit</span>
        </div>
        <button onClick={add} disabled={busy || !email.trim()} style={{ width: "100%", marginTop: 12, backgroundColor: "#D4AF37", color: "#333333", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {busy ? "Please wait..." : "Add ambassador"}
        </button>
        {msg && <p style={{ color: "#2E7D32", fontSize: 13, marginTop: 10 }}>{msg}</p>}
        {error && <p style={{ color: "#C0392B", fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>
      <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 16, padding: 16 }}>
        {loading && <p style={{ color: "#777777", fontSize: 13 }}>Loading...</p>}
        {!loading && rows.length === 0 && <p style={{ color: "#777777", fontSize: 13 }}>No ambassadors yet.</p>}
        {rows.map((r) => (
          <div key={r.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F3F3F3" }}>
            <div>
              <p style={{ color: "#333333", fontSize: 14, margin: 0 }}>{r.email || "Unknown email"}</p>
              <p style={{ color: "#777777", fontSize: 12, margin: 0 }}>{r.commission_percent}% on first deposits</p>
            </div>
            <button onClick={() => remove(r.user_id, r.email)} disabled={busy} style={{ border: "1px solid #C0392B", color: "#C0392B", backgroundColor: "#FFFFFF", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
