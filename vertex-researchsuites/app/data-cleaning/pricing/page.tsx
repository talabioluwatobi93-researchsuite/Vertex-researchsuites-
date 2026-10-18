"use client";

import FeaturePackage from "@/components/FeaturePackage";

export default function DataCleaningPricingPage() {
  return (
    <FeaturePackage
      title="Quantitative Data Cleaning"
      intro="Questionnaire answers collected as words cannot be used for quantitative analysis. We turn them into numbers."
      items={[
        "Upload the Excel spreadsheet (.xlsx or .xls, up to 20 MB) of the responses you collected",
        "Word answers such as Strongly Agree are converted to numerical values",
        "You choose the number for each word, according to the position of that item on your questionnaire",
        "A cleaned Excel file with a codebook sheet is provided for download",
        "The price is per file cleaned",
      ]}
      featureKey="data_cleaning"
      nextHref="/data-cleaning"
      chargeFeature="data_cleaning"
      chargeDescription="Quantitative Data Cleaning"
    />
  );
}
