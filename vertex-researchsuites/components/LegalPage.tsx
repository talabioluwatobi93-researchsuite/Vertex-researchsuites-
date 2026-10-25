import Link from "next/link";

export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };

const NAVY = "#0b1f3a";
const GOLD = "#D4AF37";

export default function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <div style={{ background: NAVY, minHeight: "100vh", color: "white", padding: "24px 20px 48px", fontFamily: "Arial" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", lineHeight: 1.6 }}>
        <Link href="/" style={{ color: GOLD, textDecoration: "none" }}>← Home</Link>
        <h1 style={{ fontSize: 28, margin: "16px 0 4px" }}>{title}</h1>
        <p style={{ color: "#cfd8e6", fontSize: 13, margin: "0 0 20px" }}>Last updated: {updated}</p>
        {sections.map((s) => (
          <div key={s.heading} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 19, color: GOLD, margin: "0 0 8px" }}>{s.heading}</h2>
            {s.paragraphs?.map((p, i) => (<p key={i} style={{ margin: "0 0 10px", color: "#e6ecf5" }}>{p}</p>))}
            {s.bullets && (
              <ul style={{ margin: 0, paddingLeft: 20, color: "#e6ecf5" }}>
                {s.bullets.map((b, i) => (<li key={i} style={{ marginBottom: 6 }}>{b}</li>))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
