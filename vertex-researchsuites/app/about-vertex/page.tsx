import Link from "next/link";

const NAVY = "#0b1f3a";
const GOLD = "#D4AF37";

export const metadata = { title: "About Vertex ResearchSuite" };

const POINTS = [
  { h: "No dollar barriers", t: "Fund your wallet in Naira via Paystack. No foreign card needed." },
  { h: "Pay only for what you need", t: "No monthly subscriptions. You see the fee before any task runs." },
  { h: "Results in minutes", t: "Complete quantitative and qualitative analyses in minutes, not days." },
  { h: "Complete research workflow", t: "Research topics and proposals, pilot testing and reliability studies, quantitative data cleaning and analysis, qualitative analysis, voice transcription in African and global languages, and report restyling." },
  { h: "Plain-language clarity", t: "Every result is explained clearly, so you can defend it confidently before your supervisor or panel." },
];

export default function AboutVertex() {
  return (
    <div style={{ background: NAVY, minHeight: "100vh", color: "white", fontFamily: "Arial", display: "flex", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 640, width: "100%", textAlign: "left" }}>
        <h1 style={{ color: GOLD, fontSize: 24, fontWeight: 700, lineHeight: 1.3, margin: "8px 0 16px 0" }}>
          About Vertex ResearchSuite: Built by a Nigerian Graduate Who Understands the Struggle
        </h1>

        <p style={{ color: "#e6ecf5", fontSize: 14, lineHeight: 1.7 }}>
          Most Nigerian students know the quiet panic of final-year project season or thesis writing. You have the passion to produce excellent academic work, yet there is always a wall. World-class research and data analysis tools exist online, but many are out of reach: they demand a dollar card, charge monthly subscriptions, or produce statistical output that is hard to interpret. For many students and researchers across Africa, brilliance is not the problem. Access is.
        </p>
        <p style={{ color: "#e6ecf5", fontSize: 14, lineHeight: 1.7 }}>
          Vertex ResearchSuite was built to change that. It was founded by Talabi Oluwatobi Samuel, a Mass Communication graduate of the University of Ilorin, with one clear mission: to remove the financial, technical and border barriers between African students and academic excellence.
        </p>
        <p style={{ color: "#e6ecf5", fontSize: 14, lineHeight: 1.7 }}>
          Having seen first-hand the sleepless nights, rejected proposals, messy datasets and financial strain students endure to get their research approved, Talabi set out to build an all-in-one research companion designed for our reality.
        </p>

        <h2 style={{ color: GOLD, fontSize: 18, fontWeight: 700, margin: "24px 0 8px 0" }}>Fast, secure and reliable</h2>
        <p style={{ color: "#e6ecf5", fontSize: 14, lineHeight: 1.7 }}>
          Vertex ResearchSuite is powered by Google, Amazon Web Services (AWS) and Paystack. Payments in Naira are handled securely through Paystack, and with a good internet connection, results arrive in minutes, not hours or days.
        </p>

        <h2 style={{ color: GOLD, fontSize: 18, fontWeight: 700, margin: "24px 0 8px 0" }}>Why researchers trust Vertex ResearchSuite</h2>
        <div>
          {POINTS.map((p) => (
            <div key={p.h} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <p style={{ color: "white", fontSize: 14, fontWeight: 700, margin: 0 }}>{p.h}</p>
              <p style={{ color: "#e6ecf5", fontSize: 13, lineHeight: 1.6, margin: "4px 0 0 0" }}>{p.t}</p>
            </div>
          ))}
        </div>

        <p style={{ color: "#e6ecf5", fontSize: 14, lineHeight: 1.7, marginTop: 20 }}>
          Vertex ResearchSuite is a flagship product of Vertex Data Labs, a Nigerian software business registered with the Corporate Affairs Commission (CAC). More products are coming soon.
        </p>
        <p style={{ color: "#e6ecf5", fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>Founded by Talabi Oluwatobi Samuel • Operated by Vertex Data Labs (CAC Reg: 9986884). Need help? Email <a href="mailto:support@vertex-researchsuite.com" style={{ color: "inherit" }}>support@vertex-researchsuite.com</a></p>
        <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, fontStyle: "italic", textAlign: "center", margin: "16px 0 24px 0" }}>
          Smarter Research. Better Decisions. Primed for Excellence.
        </p>

        <Link href="/" style={{ display: "block", border: "2px solid white", color: "white", fontWeight: 700, padding: "12px", borderRadius: 10, textAlign: "center", textDecoration: "none", marginBottom: 10 }}>Back to landing page</Link>
        <Link href="/signup" style={{ display: "block", background: GOLD, color: "#333333", fontWeight: 700, padding: "14px", borderRadius: 10, textAlign: "center", textDecoration: "none", marginBottom: 24 }}>Sign up</Link>
      </div>
    </div>
  );
}
