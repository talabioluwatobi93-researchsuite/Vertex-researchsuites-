"use client";

import FeaturePackage from "@/components/FeaturePackage";

export default function PilotPricingPage() {
  return (
    <FeaturePackage
      title="Pilot Study & Reliability Test"
      intro="Test your questionnaire items before full data collection to see whether they should go further."
      items={[
        "Upload your pilot responses as an Excel or CSV file (.xlsx, .xls or .csv)",
        "Your question items are tested under each construct using Cronbach's alpha, where 0.70 or above is acceptable",
        "A score is given for each construct",
        "An interpretation is given for each construct",
        "The price is per pilot study session",
      ]}
      featureKey="pilot_study"
      nextHref="/pilot-study"
      chargeFeature="pilot_study"
      chargeDescription="Pilot Study & Reliability Test"
    />
  );
}
