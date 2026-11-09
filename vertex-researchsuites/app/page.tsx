import Link from "next/link";

const NAVY = "#0b1f3a";
const GOLD = "#D4AF37";

const FAQ_ITEMS = [
  { q: "What is Vertex Researchsuite?", a: "Vertex Researchsuite helps with research topics and proposals, pilot studies, quantitative data cleaning, quantitative and qualitative data analysis, voice transcription and report restyling. You pay only for what you use, with no subscription." },
  { q: "Who is Vertex for?", a: "Vertex is for students, researchers, research organisations, institutions, marketing researchers and anyone who needs clear, fast research support." },
  { q: "Why are the features so cheap? Is it a scam?", a: "No. Vertex is a registered business, Vertex Data Labs (Registration No. 9986884). It is affordable because it is automated. There are no analyst hours to bill, so you pay for the tool and not for someone’s time. You also never pay blindly: you see the exact fee before anything runs, you pay from your own wallet only for what you use, and every purchase gives you a receipt in Purchase History. Try a small feature first, such as Voice Transcription, and judge the quality yourself." },
  { q: "Will cheaper analysis make me doubt the quality?", a: "Price reflects automation, not quality. The same standard tests are used, and you get results in minutes. Vertex supports your work and does not replace your supervisor, so review the output against your study before you submit." },
  { q: "Are the results accurate?", a: "Results are produced by Vertex’s statistical arithmetic analysis engine. Every output comes with tables and a plain-language interpretation. As with any statistical tool, check your variables, names, quotes and interpretation before you submit." },
  { q: "Are the analysis features trying to replace human analysts?", a: "No. Vertex does not replace analysts or your supervisor. It makes routine analysis faster, easier and clearer for everyone, so you can spend your time understanding and writing up your results. We are adding how-to videos to guide you through each feature step by step." },
  { q: "How do I add money to my wallet, and what is the minimum?", a: "Open your wallet, tap Top Up and pay with Paystack. The minimum deposit is ₦500." },
  { q: "Where do I find my receipt?", a: "After a purchase, open Purchase History to view or download your receipt." },
  { q: "How does Voice Transcription work, and how long can an upload be?", a: "Upload one audio file at a time. African languages: up to 3 minutes per upload. Global languages: up to 5 minutes per upload. A bigger upgrade is coming soon." },
  { q: "Will I be able to upload longer audio?", a: "Yes. Longer uploads are in development by our tech team, and we will announce them as soon as they are ready." },
  { q: "Do I earn from the people my referrals refer?", a: "No. You earn only on deposits made by people you referred directly. To get your personal link, open the Referral feature in your account." },
];

export default function Home() {
  return (
    <div style={{ background: NAVY, minHeight: "100vh", color: "white", fontFamily: "Arial", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
      <div style={{ maxWidth: 560, textAlign: "center", lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 34, margin: "0 0 10px" }}>Vertex ResearchSuite</h1>
        <p style={{ color: GOLD, fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>Smarter Research, Better Decisions, Primed for Excellence</p>
        <p style={{ color: "#cfd8e6", fontSize: 15, margin: "0 0 22px" }}>Built for Africa, to the world.</p>
        <p style={{ color: "#e6ecf5", fontSize: 15, margin: "0 0 22px" }}>Built for students and researchers who want clear results, fast.</p>
        <p style={{ color: "#e6ecf5", fontSize: 16, margin: "0 0 26px" }}>
          Vertex ResearchSuite brings your whole research workflow into one place: topics and proposals, pilot studies, data cleaning, quantitative and qualitative analysis, voice transcription in African and global languages, and report restyling. Every result is explained in plain language, and you always see the fee before anything runs.
        </p>
        <p style={{ color: "#cfd8e6", fontSize: 13, margin: "0 0 14px" }}>
          By continuing you accept the{" "}
          <Link href="/terms" style={{ color: GOLD }}>Terms</Link> and{" "}
          <Link href="/privacy" style={{ color: GOLD }}>Privacy Policy</Link>.
        </p>
        <p style={{ color: "#cfd8e6", fontSize: 13, margin: "0 0 14px" }}>
          For the best experience and layout, please use a laptop or desktop computer.
        </p>
        <Link href="/signup" style={{ display: "block", background: GOLD, color: "#333333", fontWeight: 700, padding: "14px", borderRadius: 10, textDecoration: "none", marginBottom: 12 }}>
          Accept and Sign up
        </Link>
        <Link href="/about" style={{ display: "block", border: "2px solid white", color: "white", fontWeight: 700, padding: "12px", borderRadius: 10, textDecoration: "none", marginBottom: 18 }}>
          Read about
        </Link>
        <Link href="/login" style={{ color: "#cfd8e6", fontSize: 14 }}>Already have an account? Login</Link>
        <div style={{ marginTop: 28, textAlign: "left" }}>
          <h2 style={{ color: GOLD, fontSize: 18, margin: "0 0 12px", textAlign: "center" }}>Frequently asked questions</h2>
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <summary style={{ color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{item.q}</summary>
              <p style={{ color: "#e6ecf5", fontSize: 13, lineHeight: 1.6, margin: "8px 0 0" }}>{item.a}</p>
            </details>
          ))}
        </div>
        <div style={{ marginTop: 24, fontSize: 11, lineHeight: 1.6, color: "#8a97ab", textAlign: "center" }}>
          <p style={{ margin: "0 0 4px" }}>© 2026 Vertex Data Labs. All rights reserved.</p>
          <p style={{ margin: 0 }}>Vertex ResearchSuite is a product of Vertex Data Labs, a business registered with the Corporate Affairs Commission (CAC), Nigeria. Registration No. 9986884.</p>
        </div>
      </div>
    </div>
  );
}
