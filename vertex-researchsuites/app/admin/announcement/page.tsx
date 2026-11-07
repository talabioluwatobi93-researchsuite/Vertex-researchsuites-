"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

async function api(method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/announcement", {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session?.access_token || "") },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export default function AdminAnnouncementPage() {
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(false);
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const d = await api("GET");
        const r = d.row;
        if (r) {
          setMessage(r.message || "");
          setActive(!!r.is_active);
          setEndsAt(r.ends_at ? String(r.ends_at).slice(0, 10) : "");
        }
      } catch (e: any) { setError(e.message || "Could not load."); }
      setLoading(false);
    })();
  }, []);

  async function save(nextActive: boolean) {
    setBusy(true); setError(""); setMsg("");
    try {
      await api("POST", { message, is_active: nextActive, ends_at: endsAt ? endsAt + "T23:59:59Z" : null });
      setActive(nextActive);
      setMsg(nextActive ? "Saved. The message is showing." : "Saved. The message is hidden.");
    } catch (e: any) { setError(e.message || "Could not save."); }
    setBusy(false);
  }

  const box = { background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 12, padding: 16, marginBottom: 14 } as const;

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: "#333333", fontSize: 22, fontWeight: 700, margin: 0 }}>Announcement</h1>
        <p style={{ color: "#777777", fontSize: 13, marginBottom: 14 }}>
          One line that scrolls at the top of every screen. Plain text only, max 300 characters.
        </p>
        {error ? <p style={{ color: "#C0392B", fontSize: 14 }}>{error}</p> : null}
        {msg ? <p style={{ color: "#2E7D32", fontSize: 14 }}>{msg}</p> : null}
        {loading ? <p style={{ color: "#777777" }}>Loading...</p> : (
          <>
            <div style={box}>
              <textarea value={message} maxLength={300} rows={3} onChange={(e) => setMessage(e.target.value)} placeholder="Type the message students will see" style={{ width: "100%", padding: 10, border: "1px solid #DDDDDD", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              <div style={{ color: "#777777", fontSize: 12, margin: "6px 0 10px" }}>{message.length}/300 | Status: {active ? "SHOWING" : "HIDDEN"}</div>
              <label style={{ color: "#333333", fontSize: 13 }}>End date (optional): </label>
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={{ padding: 6, border: "1px solid #DDDDDD", borderRadius: 8 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={() => save(true)} disabled={busy} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#2E7D32", color: "#FFFFFF", fontWeight: 600 }}>Save and show</button>
              <button onClick={() => save(false)} disabled={busy} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #DDDDDD", background: "#FFFFFF", color: "#333333" }}>Save and hide</button>
            </div>
            <div style={box}>
              <div style={{ color: "#777777", fontSize: 12, marginBottom: 6 }}>Preview</div>
              <div style={{ background: "#FDE68A", color: "#1F2937", fontSize: 14, padding: "6px 10px", borderRadius: 6, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{message || "(empty)"}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
