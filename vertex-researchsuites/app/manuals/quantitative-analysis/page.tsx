import ManualPage from "../../../components/ManualPage";
import { content } from "../../../lib/manual-content/quantitative-analysis";

const URL = "https://www.vertex-researchsuite.com/manuals/quantitative-analysis";
const TITLE = "Quantitative Data Analysis User Manual | Vertex ResearchSuite";
const DESC = "Step-by-step guide to Quantitative Data Analysis in Vertex ResearchSuite: upload cleaned survey data, choose your tests, and get APA tables, plain-language interpretation, Chapter 5 and defense questions.";

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: "Vertex ResearchSuite", type: "article" },
};

export default function Page() {
  return <ManualPage slug="quantitative-analysis" content={content} />;
}
