"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from '@/lib/supabase';
import { FEATURES } from "@/lib/aboutContent";

const NAVY = "#0b1f3a";
const GOLD = "#D4AF37";

export default function AboutFeaturePage() {
  const params = useParams();
  const slug = String(params?.feature ?? "");
  const f = FEATURES.find((x) => x.slug === slug);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!f || f.prices.length === 0) return;
    let active = true;
    supabase
      .from("feature_pricing")
      .select("feature_name, price")
      .in("feature_name", f.prices.map((p) => p.key))
      .then(({ data }) => {
        if (!active || !data) return;
        const m: Record<string, number> = {};
        data.forEach((r: any) => { m[r.feature_name] = Number(r.price); });
        setPrices(m);
      });
    return () => { active = false; };
  }, [f]);

  const show = (k: string) =>
    k in prices ? (prices[k] > 0 ? "₦" + prices[k].toLocaleString("en-NG") : "Free") : "Shown before you start";

  if (!f) {
    return (
      <div style={{ background: NAVY, minHeight: "100vh", color: "white", padding: 24, fontFamily: "Arial" }}>
        <p>Feature not found.</p>
        <Link href="/about" style={{ color: GOLD }}>← All features</Link>
      </div>
    );
  }

  return (
    <div style={{ background: NAVY, minHeight: "100vh", color: "white", padding: "24px 20px 48px", fontFamily: "Arial" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", lineHeight: 1.6 }}>
        <Link href="/about" style={{ color: GOLD, textDecoration: "none" }}>← All features</Link>
        <h1 style={{ fontSize: 28, margin: "16px 0 8px" }}>{f.title}</h1>
        <p style={{ color: GOLD, fontSize: 18, margin: "0 0 20px" }}>{f.tagline}</p>
        {f.sections.map((s) => (
          <div key={s.heading} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 20, color: GOLD, margin: "0 0 8px" }}>{s.heading}</h2>
            {s.paragraphs?.map((p, i) => (
              <p key={i} style={{ margin: "0 0 10px", color: "#e6ecf5" }}>{p}</p>
            ))}
            {s.bullets && (
              <ul style={{ margin: 0, paddingLeft: 20, color: "#e6ecf5" }}>
                {s.bullets.map((b, i) => (<li key={i} style={{ marginBottom: 6 }}>{b}</li>))}
              </ul>
            )}
          </div>
        ))}
        <div style={{ border: "1px solid " + GOLD, borderRadius: 14, padding: "14px 18px", marginBottom: 22 }}>
          <h2 style={{ fontSize: 20, color: GOLD, margin: "0 0 8px" }}>Price</h2>
          {f.prices.map((p) => (
            <div key={p.key} style={{ marginBottom: 4 }}>
              {p.label}: <b>{show(p.key)}</b>{p.per && prices[p.key] > 0 ? " " + p.per : ""}
            </div>
          ))}
          <div style={{ color: "#cfd8e6", fontSize: 13, marginTop: 8 }}>You always see the fee before anything runs.</div>
        </div>
        <Link href="/signup" style={{ display: "block", textAlign: "center", background: GOLD, color: "#333333", fontWeight: 700, padding: "14px", borderRadius: 10, textDecoration: "none" }}>
          {f.button}
        </Link>
      </div>
    </div>
  );
}
