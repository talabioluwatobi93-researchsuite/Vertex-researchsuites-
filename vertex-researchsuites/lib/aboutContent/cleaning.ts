import type { Feature } from "./types";
export const cleaning: Feature = {
  slug: "data-cleaning",
  title: "Quantitative Data Cleaning",
  tagline: "From messy survey answers to analysis-ready numbers.",
  summary: "Turn word answers like 'Strongly Agree' into numbers, with a codebook.",
  button: "Clean my data",
  prices: [{ label: "Per file cleaned", key: "data_cleaning" }],
  sections: [
    { heading: "Your data is only as good as its coding", paragraphs: [
      "Google Forms, SurveyMonkey and Excel exports give you words: 'Strongly Agree', 'Disagree', 'Neutral'. Statistical work needs numbers. Converting hundreds or thousands of cells by hand is slow, tiring and error-prone, and one wrong code can quietly change every mean, correlation and regression that follows.",
      "Vertex does the conversion for you, and you stay in control of what each answer means. It suits students, researchers, lecturers, institutions, market researchers and organisations.",
    ] },
    { heading: "How it works", bullets: [
      "Upload your responses as an Excel file (.xlsx or .xls, up to 20 MB).",
      "Review the word answers found in each question.",
      "Choose the number for each word, according to the position of that item on your questionnaire. A positively worded item and a negatively worded item may need opposite codes.",
      "Check your coding in the review step before anything is finalised.",
      "Download your cleaned Excel file.",
    ] },
    { heading: "What you receive", bullets: [
      "A cleaned Excel dataset with numeric values, ready for analysis",
      "A codebook sheet in the same file, recording what each number stands for, so you, your supervisor, client or auditor can trace every decision",
    ] },
    { heading: "Why people choose it", bullets: [
      "Traceability: the codebook documents your coding and makes your method easy to defend.",
      "You decide the codes, so the result matches your instrument, not a generic guess.",
      "It saves hours on every questionnaire.",
      "It prepares the ground for Quantitative Data Analysis, so your data moves from raw responses to tables and interpretation.",
    ] },
    { heading: "Good to know", paragraphs: [
      "Use your questionnaire as the guide when you assign numbers, and check the cleaned file against your original responses before analysis.",
    ] },
  ],
};
