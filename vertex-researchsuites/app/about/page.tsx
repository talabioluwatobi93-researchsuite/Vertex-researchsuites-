"use client";
import Link from "next/link";
import { FEATURES } from "@/lib/aboutContent";

const NAVY = "#0b1f3a";
const GOLD = "#D4AF37";

export default function AboutPage() {
  return (
    <div style={{ background: NAVY, minHeight: "100vh", color: "white", padding: "24px 20px", fontFamily: "Arial" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={{ color: GOLD, textDecoration: "none" }}>← Home</Link>
        <h1 style={{ fontSize: 28, margin: "16px 0 8px" }}>What Vertex Researchsuite does</h1>
        <p style={{ color: "#cfd8e6", margin: "0 0 20px" }}>Tap a feature to read about it.</p>
        {FEATURES.map((f) => (
          <Link key={f.slug} href={"/about/" + f.slug} style={{ display: "block", textDecoration: "none", color: "white", border: "1px solid " + GOLD, borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ color: GOLD, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{f.title}</div>
            <div style={{ color: "#cfd8e6", fontSize: 14 }}>{f.summary}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
