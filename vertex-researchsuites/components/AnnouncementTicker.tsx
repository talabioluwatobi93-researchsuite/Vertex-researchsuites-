"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AnnouncementTicker() {
  const [text, setText] = useState("");
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("vx_ticker_closed") === "1") setHidden(true);
    } catch {}
    (async () => {
      try {
        const { data } = await supabase
          .from("site_announcements")
          .select("message")
          .limit(1)
          .maybeSingle();
        setText(data && data.message ? String(data.message).trim() : "");
      } catch {}
    })();
  }, []);

  if (hidden || !text) return null;

  function close() {
    setHidden(true);
    try { sessionStorage.setItem("vx_ticker_closed", "1"); } catch {}
  }

  const secs = Math.max(15, Math.round(text.length * 0.3));

  return (
    <div role="status" style={{ display: "flex", alignItems: "center", background: "#FDE68A", color: "#1F2937", fontSize: 14, width: "100%" }}>
      <style>{`
        @keyframes vx-scroll { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        .vx-track { display: inline-block; white-space: nowrap; padding: 6px 0 6px 100%; animation: vx-scroll linear infinite; }
        @media (prefers-reduced-motion: reduce) { .vx-track { animation: none; white-space: normal; padding: 6px 10px; } }
      `}</style>
      <div style={{ flex: 1, overflow: "hidden" }} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <span className="vx-track" style={{ animationDuration: secs + "s", animationPlayState: paused ? "paused" : "running" }}>{text}</span>
      </div>
      <button onClick={close} aria-label="Close announcement" style={{ border: "none", background: "transparent", color: "#1F2937", fontSize: 18, padding: "4px 12px", cursor: "pointer" }}>x</button>
    </div>
  );
}
