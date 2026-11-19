import Link from "next/link";
import { MANUALS_LIST } from "../../lib/manuals";

const GOLD = "#d4af37";
const URL = "https://www.vertex-researchsuite.com/manuals";
const TITLE = "User Manuals & Sample Outputs | Vertex ResearchSuite";
const DESC = "Step-by-step user manuals for every Vertex ResearchSuite feature: research topics and proposals, pilot study and reliability tests, data cleaning, quantitative and qualitative analysis, report restyling and voice transcription.";

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: "Vertex ResearchSuite", type: "website" },
};

export default function ManualsIndex() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "#e6ecf5", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/" style={{ color: GOLD, fontSize: 14, textDecoration: "none" }}>{"<- Back to Vertex ResearchSuite"}</Link>
        <h1 style={{ fontSize: 28, margin: "16px 0 8px", color: "#ffffff" }}>User Manuals & Sample Outputs</h1>
        <p style={{ lineHeight: 1.7, color: "#cfd8e6" }}>Pick a feature to see how it works, step by step, with the fee shown before anything runs. Every manual also has a PDF copy you can download.</p>
        {MANUALS_LIST.map((m) => (
          <div key={m.slug} style={{ border: "1px solid #2a3550", borderRadius: 10, padding: 16, margin: "14px 0", background: "#111a30" }}>
            <h2 style={{ fontSize: 18, margin: "0 0 6px", color: "#ffffff" }}>{m.label}</h2>
            <p style={{ margin: "0 0 12px", color: "#cfd8e6", lineHeight: 1.6 }}>{m.blurb}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {m.hasPage ? <Link href={"/manuals/" + m.slug} style={{ background: GOLD, color: "#0b1220", fontWeight: 700, padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Read manual</Link> : null}
              <a href={"/manuals/" + m.pdf} style={{ border: "1px solid " + GOLD, color: GOLD, padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Download PDF</a>
            </div>
          </div>
        ))}
        <p style={{ marginTop: 28, fontSize: 13, color: "#8a97ab", textAlign: "center" }}>Need help? Email support@vertex-researchsuite.com</p>
      </div>
    </main>
  );
}
