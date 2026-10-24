"use client";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#D4AF37";
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, border: "1px solid #EEEEEE" };
const inp: CSSProperties = { width: "100%", padding: 12, marginBottom: 10, borderRadius: 8, border: "1px solid #EEEEEE", boxSizing: "border-box" };
const btn: CSSProperties = { padding: "12px 16px", background: GOLD, color: "#333333", fontWeight: "bold", border: "none", borderRadius: 8, cursor: "pointer" };
const naira = (n: number) => "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const label: Record<string, string> = { pending: "Pending", paid: "Paid", rejected: "Rejected" };

export default function ReferralsPage() {
  const [code, setCode] = useState("");
  const [st, setSt] = useState<any>(null);
  const [referred, setReferred] = useState(0);
  const [comms, setComms] = useState<any[]>([]);
  const [wds, setWds] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [num, setNum] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session ? data.session.access_token : "";
  }
  async function call(path: string, body?: any) {
    const t = await token();
    const res = await fetch(path, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    let data: any = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, data };
  }
  async function load() {
    const t = await token();
    if (!t) { window.location.href = "/login"; return; }
    const c = await call("/api/referrals/my-code");
    if (c.ok && c.data && c.data.code) setCode(c.data.code); else setErr("Could not load your referral code. Please refresh.");
    const s = await supabase.from("referral_settings").select("*").eq("id", 1).maybeSingle();
    const rr = await supabase.from("referral_rates").select("commission_percent").maybeSingle();
    setSt(s.data && rr.data && Number(rr.data.commission_percent) > 0 ? { ...s.data, commission_percent: rr.data.commission_percent } : s.data);
    const r = await supabase.from("referrals").select("referred_user_id");
    setReferred((r.data || []).length);
    const cm = await supabase.from("referral_commissions").select("amount,created_at").order("created_at", { ascending: false });
    setComms(cm.data || []);
    const w = await supabase.from("referral_withdrawals").select("amount,status,created_at").order("created_at", { ascending: false });
    setWds(w.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const link = typeof window !== "undefined" && code ? window.location.origin + "/signup?ref=" + code : "";
  const earned = comms.reduce((a, x) => a + Number(x.amount || 0), 0);
  const used = wds.filter((x) => x.status === "pending" || x.status === "paid").reduce((a, x) => a + Number(x.amount || 0), 0);
  const avail = Math.max(0, earned - used);
  const pct = st ? Number(st.commission_percent) : 0;
  const min = st ? Number(st.min_withdrawal) : 0;
  const canWd = !!st && !!st.withdrawals_open && avail > 0 && avail >= min;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setMsg("Link copied."); } catch { setMsg("Press and hold the link to copy it."); }
  }
  async function withdraw() {
    setErr(""); setMsg(""); setBusy(true);
    const r = await call("/api/referrals/withdraw", { account_name: name, bank_name: bank, account_number: num });
    setBusy(false);
    if (r.ok) {
      setMsg("Request received. It shows as Pending until it is paid in the monthly payout.");
      setName(""); setBank(""); setNum("");
      await load();
    } else if (r.data && r.data.error === "below_minimum") setErr("You need at least " + naira(r.data.min) + " to withdraw.");
    else setErr((r.data && r.data.error) || "Could not save your request.");
  }

  return (
    <div style={{ background: "#F9F9F9", minHeight: "100vh", fontFamily: "Arial", padding: 20 }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <a href="/dashboard" style={{ color: "#B8860B", fontWeight: "bold", textDecoration: "none" }}>Back to dashboard</a>
        <h1 style={{ color: "#333333", fontSize: 22, margin: "12px 0" }}>My Referral Earnings</h1>
        {loading && <p style={{ color: "#888888" }}>Loading...</p>}
        {err && <p style={{ color: "#C0392B", background: "#FDEDEC", padding: 10, borderRadius: 8 }}>{err}</p>}
        {msg && <p style={{ color: "#1a6b2a" }}>{msg}</p>}
        <div style={card}>
          <div style={{ color: "#888888", fontSize: 12 }}>AVAILABLE EARNINGS</div>
          <div style={{ color: "#333333", fontSize: 28, fontWeight: "bold" }}>{naira(avail)}</div>
          <div style={{ color: "#555555", fontSize: 13, marginTop: 6 }}>Total earned {naira(earned)} | People referred {referred}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#333333", fontWeight: "bold", marginBottom: 8 }}>Your referral link</div>
          <div style={{ wordBreak: "break-all", background: "#F9F9F9", padding: 10, borderRadius: 8, color: "#555555", fontSize: 14 }}>{link || "..."}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={copy} disabled={!link} style={btn}>Copy link</button>
            <a href={"https://wa.me/?text=" + encodeURIComponent("Join me on Vertex ResearchSuite: " + link)} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: "none", background: "#EEEEEE" }}>Share on WhatsApp</a>
          </div>
          <p style={{ color: "#8a6d00", fontSize: 13 }}>
            You earn {pct}% of the first deposit of each person who registers with your link. This is a one-time reward per person. Payouts are made monthly. Rewards can be cancelled for self-referral or fraud.
          </p>
        </div>
        <div style={card}>
          <div style={{ color: "#333333", fontWeight: "bold", marginBottom: 8 }}>Withdraw</div>
          {canWd ? (
            <div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" style={inp} />
              <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Bank" style={inp} />
              <input value={num} onChange={(e) => setNum(e.target.value)} inputMode="numeric" maxLength={10} placeholder="10-digit account number" style={inp} />
              <button onClick={withdraw} disabled={busy} style={{ ...btn, width: "100%" }}>{busy ? "Saving..." : "Request withdrawal of " + naira(avail)}</button>
            </div>
          ) : (
            <p style={{ color: "#555555", fontSize: 14 }}>
              {st && !st.withdrawals_open ? "Withdrawals are not open right now." : "You can request a withdrawal once your available earnings reach " + naira(min) + "."}
            </p>
          )}
        </div>
        <div style={card}>
          <div style={{ color: "#333333", fontWeight: "bold", marginBottom: 8 }}>History</div>
          {comms.length === 0 && wds.length === 0 && <p style={{ color: "#888888", fontSize: 14 }}>Nothing yet.</p>}
          {comms.map((c, i) => (
            <div key={"c" + i} style={{ color: "#1a6b2a", fontSize: 14, padding: "4px 0" }}>Reward +{naira(c.amount)} ({String(c.created_at).slice(0, 10)})</div>
          ))}
          {wds.map((w, i) => (
            <div key={"w" + i} style={{ color: "#555555", fontSize: 14, padding: "4px 0" }}>Withdrawal {naira(w.amount)}: {label[w.status] || w.status} ({String(w.created_at).slice(0, 10)})</div>
          ))}
        </div>
      </div>
    </div>
  );
}
