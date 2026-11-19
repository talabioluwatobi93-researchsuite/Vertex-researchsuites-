import ManualPage from "../../../components/ManualPage";
import { content } from "../../../lib/manual-content/proposals";

const URL = "https://www.vertex-researchsuite.com/manuals/proposals";
const TITLE = "Research Topics & Proposals User Manual | Vertex ResearchSuite";
const DESC = "Short guide to Research Topics & Proposals in Vertex ResearchSuite: generate five research topics for your course, choose one, and download its full proposal.";

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: "Vertex ResearchSuite", type: "article" },
};

export default function Page() {
  return <ManualPage slug="proposals" content={content} />;
}
