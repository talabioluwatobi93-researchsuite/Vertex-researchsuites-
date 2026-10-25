import type { Feature } from "./types";
export const quant: Feature = {
  slug: "quantitative-analysis",
  title: "Quantitative Data Analysis",
  tagline: "A full Chapter 4 analysis, written out and ready to work into your report.",
  summary: "13 types of analysis with tables, charts, interpretation, Chapter 5 and defense prep.",
  button: "Start my analysis",
  prices: [{ label: "Per analysis", key: "quant_new_analysis" }],
  sections: [
    { heading: "Can I really get a full analysis without a statistician or a week of my life?", paragraphs: [
      "It is a fair doubt. Most people who ask it have already tried the alternatives. Licensed statistical software is costly and usually billed in foreign currency. It assumes you already know which test to run, how to set up the data and how to read the output. An analyst is expensive and you may still wait days for tables you cannot fully explain. Free tools hand you raw numbers with no interpretation.",
      "Vertex was built for the gap in the middle. You bring your questionnaire, your cleaned data and your research objectives. You get back a complete analysis, written out and ready to work into your report. It serves students, doctoral researchers, lecturers, market and social researchers, NGOs, institutions and businesses.",
    ] },
    { heading: "What you give it", bullets: [
      "Your questionnaire link, preferably a Google document",
      "Your methodology document",
      "Any two of: your research questions, your objectives, your hypotheses",
      "Your cleaned data. If your responses are still words, use Quantitative Data Cleaning first.",
    ] },
    { heading: "13 types of analysis", bullets: [
      "Correlation: Pearson, with Spearman added when your data is skewed",
      "Multiple regression, with an ANOVA table",
      "Logistic regression",
      "Independent-samples t-test",
      "Paired-samples t-test",
      "Mann-Whitney U test",
      "Wilcoxon signed-rank test",
      "One-way ANOVA",
      "Kruskal-Wallis test",
      "Two-way ANOVA",
      "Mediation analysis",
      "Moderation analysis",
      "Chi-square test",
      "Plus full descriptive statistics: frequency tables, means and standard deviations",
    ] },
    { heading: "One study, more than one question", paragraphs: [
      "Real studies rarely ask just one question. Compare men and women, then two age groups. Test moderation with a second moderator. Run one-way ANOVA on another outcome. For independent t-tests, moderation, Mann-Whitney U, one-way ANOVA and Kruskal-Wallis, you can repeat the analysis on up to two additional variable combinations, and every run goes into your report. There is no extra charge for the additional runs.",
    ] },
    { heading: "What you get back", bullets: [
      "A detailed document with tables, discussion and conclusions, organised around your own objectives and questions",
      "Tables with means, standard deviations and overall percentages, with charts that make patterns easy to see",
      "Plain-language interpretation of every table, explaining what the statistics show and whether the result meets the significance criterion",
      "A Summary of Findings and a Related Literature section",
      "Chapter 5 recommendations drawn from your findings",
      "Defense prep questions with answers, so you know what examiners are likely to ask",
      "A Word report you can download",
    ] },
    { heading: "Why it can be trusted", bullets: [
      "Numbers come from calculation, not guesswork. The statistics are computed by the app and then written up in words.",
      "Descriptive statistics, correlations and multiple regression (R-squared, F, standard errors, t, VIF and p-values) were checked against independent hand calculation.",
      "You confirm the setup of each test before it runs.",
      "Interpretations describe what the figures show, separate significance from strength, and do not claim causation from association.",
      "Every table is there for you to inspect. You remain the author of your conclusions.",
    ] },
    { heading: "The price is the point", paragraphs: [
      "A full analysis normally means a licensed package, hours or days learning it or paying someone who knows it, and then a separate writer for the interpretation, Chapter 5 and defense preparation. Vertex rolls all of that into one analysis, with Chapter 5 and defense prep included. You see the price before anything runs, and you pay once for a complete result, not a monthly licence you use for one project.",
    ] },
    { heading: "Good to know", paragraphs: [
      "Results depend on good data and a sound design. Check your cleaned data against your original responses, confirm with your supervisor or team that the chosen tests fit your study, and verify every reference before submission.",
    ] },
  ],
};
