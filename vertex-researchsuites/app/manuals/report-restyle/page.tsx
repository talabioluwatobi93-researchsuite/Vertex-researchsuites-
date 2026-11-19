import ManualPage from "../../../components/ManualPage";
import { content } from "../../../lib/manual-content/report-restyle";

const URL = "https://www.vertex-researchsuite.com/manuals/report-restyle";
const TITLE = "Restyle Your Report User Manual | Vertex ResearchSuite";
const DESC = "Short guide to Restyle Your Report in Vertex ResearchSuite: upload your Word report, choose a citation style, and download it with tables and captions converted.";

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: "Vertex ResearchSuite", type: "article" },
};

export default function Page() {
  return <ManualPage slug="report-restyle" content={content} />;
}
