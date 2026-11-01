"use client";

import FeaturePackage from "@/components/FeaturePackage";

export default function QuantPricingPage() {
  return (
    <FeaturePackage
      title="Quantitative Data Analysis"
      intro="Upload your data and get a full analysis written for your project."
      items={[
        "A complete dataset is made provided supported by 13 types of analysis from our model engine",
        "A full detailed document, tables and interpretations of each tables with discussion and conclusions",
        "Tables expanded fully expanded with their mean, standard deviation and overall percentage with charts for further understanding and beautification.",
        "A extra recommendations of the analysis (chapter 5) and also Prep defense questions to equip users to defend analysis correctly.",
        "What is needed? To carry out a successful data quantitative analysis. The following is needed:",
        "1. A questionnaire Link of your question items (preferably Google document link format)",
        "2. A document of your uploaded Methodology",
        "3. All your research questions",
        "4. All objectives",
        "5. Hypothesis",
        "(Note) Users must provide at least 2 of either number 3, 4 or 5.",
        "Before you start: know what you want to analyse. Quantitative analysis works best when you already know what you are testing. Decide your construct (the idea you are measuring), your dependent variable (the outcome you want to explain) and your independent variables or predictors (the factors you think influence it). Choosing these correctly is your responsibility, because the analysis answers only the question you set. The platform then guides you step by step: pick your analysis type, select your variables, and receive your results with a plain-language explanation. You always see the fee before anything runs.",
      ]}
      featureKey="quant_new_analysis"
      nextHref="/quantitative-analysis"
      chargeFeature="quant_new_analysis"
      chargeDescription="Quantitative Data Analysis"
    />
  );
}
