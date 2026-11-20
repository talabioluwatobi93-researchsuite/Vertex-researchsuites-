import Link from "next/link";

const GOLD = "#d4af37";

type F = { label: string; file: string };
type S = { title: string; note?: string; files: F[] };

const SAMPLES: S[] = [
  {
    title: "Research topics and proposals",
    note: "You get 4 more.",
    files: [
      { label: "Sample proposal (DOCX)", file: "topics-and-proposals.docx" },
    ],
  },
  {
    title: "Pilot testing and reliability study",
    files: [
      { label: "Pilot study results (DOCX)", file: "pilot-testing-reliability.docx" },
    ],
  },
  {
    title: "Quantitative data cleaning",
    files: [
      { label: "Before: raw data (XLSX)", file: "data-cleaning-before.xlsx" },
      { label: "After: cleaned data (XLSX)", file: "data-cleaning-after.xlsx" },
    ],
  },
  {
    title: "Quantitative data analysis",
    files: [
      { label: "Full analysis report (DOCX)", file: "quantitative-analysis-report.docx" },
    ],
  },
  {
    title: "Qualitative data analysis",
    files: [
      { label: "Chapter 4 report (DOCX)", file: "qualitative-chapter4-report.docx" },
      { label: "Evidence file (XLSX)", file: "qualitative-evidence-file.xlsx" },
    ],
  },
  {
    title: "Restyle your report",
    files: [
      { label: "Before: original report (DOCX)", file: "restyle-before.docx" },
      { label: "After: APA 7 restyled report (DOCX)", file: "restyle-after-apa7.docx" },
    ],
  },
  {
    title: "Voice transcription (African and global languages)",
    files: [
      { label: "Transcript (DOCX)", file: "voice-transcript.docx" },
      { label: "Interpretive notes (DOCX)", file: "voice-interpretive-notes.docx" },
    ],
  },
];
const WRAP = { maxWidth: 720, margin: "0 auto", padding: 16, color: "#e6ecf5" };
const BOX = {
  border: "1px solid " + GOLD,
  borderRadius: 10,
  padding: 14,
  marginTop: 14,
};
const LINK = { display: "block", marginTop: 8, color: "#e6ecf5" };

export default function SamplesPage() {
  return (
    <main style={WRAP}>
      <Link href="/" style={{ color: GOLD }}>Back</Link>
      <h1 style={{ color: GOLD, fontSize: 24 }}>Sample outputs</h1>
      <p>Download the exact files you get back from each feature.</p>
      {SAMPLES.map((s) => (
        <section key={s.title} style={BOX}>
          <h2 style={{ color: GOLD, fontSize: 18, margin: 0 }}>{s.title}</h2>
          {s.files.map((f) => (
            <a key={f.file} href={"/samples/" + f.file} download style={LINK}>
              {f.label}
            </a>
          ))}
          {s.note && <p style={{ color: GOLD, fontWeight: 700 }}>{s.note}</p>}
        </section>
      ))}
    </main>
  );
}
