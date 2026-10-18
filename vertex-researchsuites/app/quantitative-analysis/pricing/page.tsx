"use client";

import FeaturePackage from "@/components/FeaturePackage";

export default function QuantPricingPage() {
  return (
    <FeaturePackage
      title="Quantitative Data Analysis"
      intro="Upload your data and get a full analysis written for your project."
      items={[
        "Response rate checks",
        "Reliability (Cronbach's Alpha)",
        "Full inferential statistics",
        "AI-written interpretation with defense-ready explanations",
      ]}
      featureKey="quant_new_analysis"
      nextHref="/quantitative-analysis"
    />
  );
}
