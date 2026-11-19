import Link from "next/link";
import { MANUALS_LIST } from "../lib/manuals";
import type { Block, ManualContent } from "../lib/manuals";

const GOLD = "#d4af37";
const NOTE: Record<string, { bg: string; bar: string }> = {
  tip: { bg: "#1b2a1f", bar: "#3fa66b" },
  warn: { bg: "#2d1a1a", bar: "#d9534f" },
  info: { bg: "#2a2614", bar: GOLD },
};

function renderBlock(b: Block, i: number) {
  if (b.t === "p") {
    return <p key={i} style={{ lineHeight: 1.7, margin: "8px 0" }}>{b.text}</p>;
  }
  if (b.t === "h") {
    return (
      <h2 key={i} style={{ fontSize: 20, margin: "28px 0 8px", color: "#ffffff", borderBottom: "1px solid " + GOLD, paddingBottom: 6 }}>
        {b.step ? <span style={{ background: GOLD, color: "#0b1220", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 4, marginRight: 10 }}>{b.step}</span> : null}
        {b.text}
      </h2>
    );
  }
  if (b.t === "ul") {
    return <ul key={i} style={{ lineHeight: 1.7, paddingLeft: 22, margin: "8px 0" }}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>;
  }
  if (b.t === "ol") {
    return <ol key={i} style={{ lineHeight: 1.7, paddingLeft: 22, margin: "8px 0" }}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ol>;
  }
  if (b.t === "note") {
    const c = NOTE[b.kind];
    return (
      <div key={i} style={{ background: c.bg, borderLeft: "4px solid " + c.bar, padding: "10px 14px", margin: "14px 0", borderRadius: 6 }}>
        <strong style={{ display: "block", marginBottom: 4 }}>{b.title}</strong>
        <span style={{ lineHeight: 1.6 }}>{b.text}</span>
      </div>
    );
  }
  return (
    <div key={i} style={{ overflowX: "auto", margin: "12px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead>
          <tr>{b.head.map((h, j) => <th key={j} style={{ border: "1px solid #2a3550", padding: 8, background: "#16203a", color: GOLD, textAlign: "left" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} style={{ border: "1px solid #2a3550", padding: 8, verticalAlign: "top" }}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function ManualPage({ slug, content }: { slug: string; content: ManualContent }) {
  const m = MANUALS_LIST.find((x) => x.slug === slug);
  if (m === undefined) return null;
  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "#e6ecf5", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/manuals" style={{ color: GOLD, fontSize: 14, textDecoration: "none" }}>{"<- All user manuals"}</Link>
        <h1 style={{ fontSize: 28, margin: "16px 0 8px", color: "#ffffff" }}>{m.label}: User Manual</h1>
        <p style={{ lineHeight: 1.7, color: "#cfd8e6" }}>{content.intro}</p>
        {content.fee ? <p>Fee: <strong style={{ color: GOLD }}>{content.fee}</strong></p> : null}
        <a href={"/manuals/" + m.pdf} download style={{ display: "inline-block", background: GOLD, color: "#0b1220", fontWeight: 700, padding: "10px 16px", borderRadius: 8, textDecoration: "none", margin: "8px 0 4px" }}>Download PDF Copy</a>
        {content.blocks.map(renderBlock)}
        <p style={{ marginTop: 36, fontSize: 13, color: "#8a97ab", textAlign: "center", lineHeight: 1.6 }}>
          Need help? Email support@vertex-researchsuite.com<br />
          Vertex ResearchSuite is a product of Vertex Data Labs (CAC Reg: 9986884)
        </p>
      </div>
    </main>
  );
}
