import ManualPage from "../../../components/ManualPage";
import { content } from "../../../lib/manual-content/pilot-study";

const URL = "https://www.vertex-researchsuite.com/manuals/pilot-study";
const TITLE = "Pilot Study & Reliability Test User Manual | Vertex ResearchSuite";
const DESC = "Short guide to the Pilot Study & Reliability Test in Vertex ResearchSuite: run Cronbach’s alpha on your questionnaire, read the results, and know what to do if a result does not pass.";

export const metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: "Vertex ResearchSuite", type: "article" },
};

export default function Page() {
  return <ManualPage slug="pilot-study" content={content} />;
}
