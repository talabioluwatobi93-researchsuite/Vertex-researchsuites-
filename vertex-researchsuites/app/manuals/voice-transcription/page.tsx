import ManualPage from "../../../components/ManualPage";
import { content } from "../../../lib/manual-content/voice-transcription";

const URL = "https://www.vertex-researchsuite.com/manuals/voice-transcription";
const TITLE = "Voice Transcription & Analysis User Manual | Vertex ResearchSuite";
const DESC = "Short guide to Voice Transcription & Analysis in Vertex ResearchSuite: upload interview audio, choose the language, and get a transcript with interpretive notes.";

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: "Vertex ResearchSuite", type: "article" },
};

export default function Page() {
  return <ManualPage slug="voice-transcription" content={content} />;
}
