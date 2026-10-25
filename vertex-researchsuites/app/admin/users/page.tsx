"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from '@/lib/supabase';


type U = { id: string; email: string; created_at: string; last_sign_in_at: string | null; balance: number };

const naira = (n: number) => "\u20A6" + Number(n || 0).toLocaleString();
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "never");

async function api(qs: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/overview?" + qs, { headers: { Authorization: "Bearer " + (session?.access_token || "") } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (p: number) => {
    setLoading(true); setError("");
    try {
      const d = await api("view=users&page=" + p);
      setUsers((prev) => (p === 1 ? d.users : [...prev, ...d.users]));
      setPage(p); setMore(!!d.more);
    } catch (e: any) { setError(e.message || "Could not load."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(1); }, [load]);
  const shown = users.filter((u) => u.email.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: "#333333", fontSize: 22, fontWeight: 700, margin: 0 }}>Users</h1>
        <p style={{ color: "#777777", fontSize: 13 }}>{users.length} loaded</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #DDDDDD", borderRadius: 10, fontSize: 14, color: "#333333", marginBottom: 12 }} />
        {error ? <p style={{ color: "#C0392B", fontSize: 14 }}>{error}</p> : null}
        {shown.map((u) => (
          <div key={u.id} style={{ background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#333333", fontSize: 14, fontWeight: 600, wordBreak: "break-all" }}>{u.email || u.id}</div>
              <div style={{ color: "#777777", fontSize: 12 }}>Joined {day(u.created_at)} | Last seen {day(u.last_sign_in_at)}</div>
            </div>
            <div style={{ color: "#333333", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{naira(u.balance)}</div>
          </div>
        ))}
        {loading ? <p style={{ color: "#777777" }}>Loading...</p> : null}
        {more && !loading ? (
          <button onClick={() => load(page + 1)} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#D4AF37", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Load more</button>
        ) : null}
      </div>
    </div>
  );
}
