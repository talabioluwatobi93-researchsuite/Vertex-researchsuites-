"use client";

import FeaturePackage from "@/components/FeaturePackage";
import { CITATION_STYLES } from "@/lib/citationStyles";

export default function RestylePricingPage() {
  const names = CITATION_STYLES.map((s) => s.label.split(/ [\u2013\u2014-] /)[0]).join(", ");
  return (
    <FeaturePackage
      title="Restyle Your Report"
      intro="Restyle your documents, tables, thesis or any written work into the citation style you choose."
      items={[
        "Upload your report (.docx, up to 4 MB) with its tables",
        "Every table, caption and interpretation is converted to your chosen style",
        CITATION_STYLES.length + " citation styles: " + names,
        "Your charts and numbers stay exactly as they are",
        "A new Word (.docx) file is provided for download",
      ]}
      featureKey="report_restyle"
      nextHref="/report-restyle"
      chargeFeature="report_restyle"
      chargeDescription="Restyle Your Report"
    />
  );
}
