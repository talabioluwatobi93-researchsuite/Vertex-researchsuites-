"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from '@/lib/supabase';

const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#777777";
const BORDER = "#EEEEEE";


type Slide = { id: string; title: string; text: string; icon: string; image_url: string };

const FALLBACK: Record<"top" | "bottom", Slide[]> = {
  top: [
    { id: "t1", icon: "\uD83D\uDC4B", title: "Welcome, {name}", text: "Research, writing and analysis tools in one place.", image_url: "" },
    { id: "t2", icon: "\uD83D\uDE80", title: "Explore the tools", text: "Topics, pilot study, data analysis, voice transcription and more.", image_url: "" },
  ],
  bottom: [
    { id: "b1", icon: "\u26A1", title: "Fast, efficient, excellent", text: "Quick turnaround and careful, reliable results.", image_url: "" },
    { id: "b2", icon: "\u2B50", title: "Quality you can trust", text: "Every tool is built around accuracy and reliability.", image_url: "" },
  ],
};

export default function BannerSlider({ placement, name }: { placement: "top" | "bottom"; name?: string }) {
  const first = (name || "").trim() || "there";
  const [slides, setSlides] = useState<Slide[]>(FALLBACK[placement]);
  const [idx, setIdx] = useState(FALLBACK[placement].length - 1);
  const paused = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await supabase
          .from("billboard_slides")
          .select("id,title,text,icon,image_url")
          .eq("is_active", true)
          .eq("placement", placement)
          .order("sort_order", { ascending: true });
        if (!active || !data || data.length === 0) return;
        setSlides(data.map((r: any) => ({ id: r.id, title: r.title || "", text: r.text || "", icon: r.icon || "", image_url: r.image_url || "" })));
      } catch {}
    }
    load();
    return () => { active = false; };
  }, [placement]);

  useEffect(() => { setIdx(slides.length - 1); }, [slides]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      if (paused.current) return;
      setIdx((p) => (p <= 0 ? slides.length - 1 : p - 1));
    }, 4500);
    return () => clearInterval(t);
  }, [slides]);

  const fill = (s: string) => s.split("{name}").join(first);
  const shown = [...slides].reverse();
  const current = slides.length - 1 - idx;

  return (
    <div
      onTouchStart={() => { paused.current = true; }}
      onTouchEnd={() => { paused.current = false; }}
      style={{ margin: "12px 0", overflow: "hidden", borderRadius: 14, border: "1px solid " + BORDER, background: "#FFFFFF" }}
    >
      <div style={{ display: "flex", transform: "translateX(-" + idx * 100 + "%)", transition: "transform 0.6s ease" }}>
        {shown.map((s) => (
          <div key={s.id} style={{ flex: "0 0 100%", boxSizing: "border-box", padding: "16px 18px", display: "flex", gap: 12, alignItems: "center" }}>
            {s.image_url ? (
              <img src={s.image_url} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 10 }} />
            ) : (
              <div style={{ fontSize: 28 }}>{s.icon}</div>
            )}
            <div>
              <div style={{ color: DARK, fontSize: 15, fontWeight: 700 }}>{fill(s.title)}</div>
              {s.text ? <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{fill(s.text)}</div> : null}
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 10 }}>
          {slides.map((s, i) => (
            <div key={s.id} style={{ width: 6, height: 6, borderRadius: 999, background: i === current ? GOLD : BORDER }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
