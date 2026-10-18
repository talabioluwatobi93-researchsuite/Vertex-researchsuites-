"use client";

import FeaturePackage from "@/components/FeaturePackage";

export default function QualPricingPage() {
  return (
    <FeaturePackage
      title="Qualitative Data Analysis"
      intro="Turn interview transcripts into themes, quoted findings and a full analysis document."
      items={[
        "Backed by 2 powerful vertex Researchsuite engine model which extract codes differently and independently from full uploaded transcript of users.",
        "An internal inter coder reliability test is performed with result output is calculated and result is given",
        "A codebook including all themes and every details is provided for users",
        "A detail Qualitative analysis document is provided with tables, themes interpretations and discussions are given",
        "Inductive thematic analysis are provided using the Clarke and Braun protocol (2006)",
        "Quality references are made available.",
      ]}
      featureKey="qualitative_analysis"
      nextHref="/qualitative-analysis"
      chargeFeature="qualitative_analysis"
      chargeDescription="Qualitative Data Analysis"
    />
  );
}
