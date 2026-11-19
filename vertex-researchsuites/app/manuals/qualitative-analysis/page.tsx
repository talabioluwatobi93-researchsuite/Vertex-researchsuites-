import ManualPage from "../../../components/ManualPage";
import { content } from "../../../lib/manual-content/qualitative-analysis";

const URL = "https://www.vertex-researchsuite.com/manuals/qualitative-analysis";
const TITLE = "Qualitative Data Analysis User Manual | Vertex ResearchSuite";
const DESC = "Step-by-step guide to Qualitative Data Analysis in Vertex ResearchSuite: turn interview transcripts into themes, a results report, an evidence file, and a free Chapter 5 with defense questions.";

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: "Vertex ResearchSuite", type: "article" },
};

export default function Page() {
  return <ManualPage slug="qualitative-analysis" content={content} />;
}
