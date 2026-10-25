import Link from "next/link";

const NAVY = "#0b1f3a";
const GOLD = "#D4AF37";

export default function Home() {
  return (
    <div style={{ background: NAVY, minHeight: "100vh", color: "white", fontFamily: "Arial", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
      <div style={{ maxWidth: 560, textAlign: "center", lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 34, margin: "0 0 10px" }}>Vertex ResearchSuite</h1>
        <p style={{ color: GOLD, fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>Smarter Research, Better Decisions, Primed for Excellence</p>
        <p style={{ color: "#cfd8e6", fontSize: 15, margin: "0 0 22px" }}>Built for Africa, to the world.</p>
        <p style={{ color: "#e6ecf5", fontSize: 16, margin: "0 0 26px" }}>
          Vertex ResearchSuite brings your whole research workflow into one place: topics and proposals, pilot studies, data cleaning, quantitative and qualitative analysis, voice transcription in African and global languages, and report restyling. Every result is explained in plain language, and you always see the fee before anything runs.
        </p>
        <p style={{ color: "#cfd8e6", fontSize: 13, margin: "0 0 14px" }}>
          By continuing you accept the{" "}
          <Link href="/terms" style={{ color: GOLD }}>Terms</Link> and{" "}
          <Link href="/privacy" style={{ color: GOLD }}>Privacy Policy</Link>.
        </p>
        <Link href="/signup" style={{ display: "block", background: GOLD, color: "#333333", fontWeight: 700, padding: "14px", borderRadius: 10, textDecoration: "none", marginBottom: 12 }}>
          Accept and Sign up
        </Link>
        <Link href="/about" style={{ display: "block", border: "2px solid white", color: "white", fontWeight: 700, padding: "12px", borderRadius: 10, textDecoration: "none", marginBottom: 18 }}>
          Read about
        </Link>
        <Link href="/login" style={{ color: "#cfd8e6", fontSize: 14 }}>Already have an account? Login</Link>
      </div>
    </div>
  );
}
