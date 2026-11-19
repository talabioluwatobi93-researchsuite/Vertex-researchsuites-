import ManualPage from "../../../components/ManualPage";
import { content } from "../../../lib/manual-content/data-cleaning";

const URL = "https://www.vertex-researchsuite.com/manuals/data-cleaning";
const TITLE = "Quantitative Data Cleaning User Manual | Vertex ResearchSuite";
const DESC = "Short guide to Quantitative Data Cleaning in Vertex ResearchSuite: change the word answers in your survey spreadsheet into numbers, check every code, and get a cleaned file with a Codebook sheet.";

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: "Vertex ResearchSuite", type: "article" },
};

export default function Page() {
  return <ManualPage slug="data-cleaning" content={content} />;
}
