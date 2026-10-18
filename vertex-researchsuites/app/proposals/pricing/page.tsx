"use client";

import FeaturePackage from "@/components/FeaturePackage";
import { CITATION_STYLES } from "@/lib/citationStyles";

export default function ProposalsPricingPage() {
  return (
    <FeaturePackage
      title="Research Topics & Proposals"
      intro="Get topics tailored to your course and institution, then a full proposal for the topic you choose."
      items={[
        "Background of the study with its research gap",
        "The statement of the problem",
        "Objectives of the study",
        "Research questions",
        "Significance of the study",
        "Appropriate theoretical frameworks",
        "An appropriate research methodology",
        "A sampling procedure",
        "References tailored to your topic from the Crossref and OpenAlex scholarly registers",
        "Supervisor-style feedback questions with appropriate answers",
        "Everything is written in the citation style you choose (" + CITATION_STYLES.length + " styles available)",
      ]}
      featureKey="research_topics"
      nextHref="/proposals/new"
      chargeFeature="research_topics"
      chargeDescription="Research Topics & Proposals"
    />
  );
}
