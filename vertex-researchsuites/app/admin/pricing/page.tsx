"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Row = { feature_name: string; price: number };

const LABELS: Record<string, string> = {
  research_topics: "Research Topics",
  pilot_study: "Pilot Study",
  quant_new_analysis: "Quantitative Analysis (new)",
  qualitative_analysis: "Qualitative Analysis",
  data_cleaning: "Data Cleaning",
  report_restyle: "Report Restyle",
  voice_african_per_min: "Voice African (per minute)",
  voice_global_per_min: "Voice Global (per minute)",
  quant_rerun_unlock: "Quant rerun unlock (unused)",
  chapter_5: "Chapter 5 (0 = free with analysis)",
  defense_prep: "Defense Prep (0 = free with analysis)",
  quantitative_analysis: "Old duplicate (unused)",
  research_proposal_full: "Full proposal (0 = included in topics)",
  voice_transcription: "Old flat Voice key (keep 0)",
  writing_check: "Writing Check (to be removed)",
};

const naira = (n: number) => "\u20A6" + Number(n || 0).toLocaleString();

async function api(method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/pricing", {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session?.access_token || "") },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export default function AdminPricingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await api("GET");
      const list: Row[] = d.rows || [];
      setRows(list);
      const m: Record<string, string> = {};
      list.forEach((r) => { m[r.feature_name] = String(r.price); });
      setDraft(m);
    } catch (e: any) { setError(e.message || "Could not load."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(r: Row) {
    const next = Number(draft[r.feature_name]);
    if (!Number.isInteger(next) || next < 0) { setError("Enter a whole number, 0 or more."); return; }
    if (next === Number(r.price)) return;
    const label = LABELS[r.feature_name] || r.feature_name;
    if (!window.confirm("Change " + label + " from " + naira(r.price) + " to " + naira(next) + "? New purchases use the new price immediately.")) return;
    setBusy(r.feature_name); setError(""); setMsg("");
    try { await api("POST", { feature_name: r.feature_name, price: next }); setMsg("Saved: " + label + " is now " + naira(next)); await load(); }
    catch (e: any) { setError(e.message || "Could not save."); }
    setBusy("");
  }

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: "#333333", fontSize: 22, fontWeight: 700, margin: 0 }}>Pricing</h1>
        <p style={{ color: "#777777", fontSize: 13, marginBottom: 14 }}>
          Prices apply to new purchases immediately. A purchase already open keeps the price it was bought at.
        </p>
        {error ? <p style={{ color: "#C0392B", fontSize: 14 }}>{error}</p> : null}
        {msg ? <p style={{ color: "#2E7D32", fontSize: 14 }}>{msg}</p> : null}
        {loading ? <p style={{ color: "#777777" }}>Loading...</p> : null}
        {rows.map((r) => (
          <div key={r.feature_name} style={{ background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#333333", fontSize: 14, fontWeight: 600 }}>{LABELS[r.feature_name] || r.feature_name}</div>
              <div style={{ color: "#777777", fontSize: 12 }}>Now {naira(r.price)} | {r.feature_name}</div>
            </div>
            <input
              value={draft[r.feature_name] ?? ""}
              onChange={(e) => setDraft({ ...draft, [r.feature_name]: e.target.value.replace(/[^0-9]/g, "") })}
              inputMode="numeric"
              style={{ width: 90, padding: "8px 10px", border: "1px solid #DDDDDD", borderRadius: 8, fontSize: 14, color: "#333333" }}
            />
            <button onClick={() => save(r)} disabled={busy === r.feature_name} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: busy === r.feature_name ? "#CCCCCC" : "#D4AF37", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {busy === r.feature_name ? "..." : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
