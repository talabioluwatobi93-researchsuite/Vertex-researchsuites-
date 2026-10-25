import type { Feature } from "./types";
export const qual: Feature = {
  slug: "qualitative-analysis",
  title: "Qualitative Data Analysis",
  tagline: "How do I prove my themes are not just my opinion?",
  summary: "Themes, a codebook and an inter-coder reliability result from your transcript.",
  button: "Start my qualitative analysis",
  prices: [{ label: "Per analysis", key: "qualitative_analysis" }],
  sections: [
    { heading: "Every qualitative researcher meets this question", paragraphs: [
      "The supervisor, the examiner, the journal reviewer or the client will ask it, and it is fair. Interviews are rich, and one reader can see one pattern where another sees something else. The answer is a rigorous process, and Vertex builds that process into the analysis.",
    ] },
    { heading: "Two independent readings of your transcript", paragraphs: [
      "Your full transcript is read by two analytical engines that work separately. Each assigns codes without seeing the other's choices. This mirrors strong practice in qualitative research: two coders, working independently, on the same material.",
    ] },
    { heading: "Then comes the test that matters: where did they agree?", paragraphs: [
      "In 1960 the psychologist Jacob Cohen published a statistic called kappa (Educational and Psychological Measurement). Before it, researchers reported percent agreement, which is flattering and misleading, because two coders choosing at random would still agree some of the time. Kappa removes the agreement expected by chance and shows how much agreement is real.",
      "In 1977 J. Richard Landis and Gary G. Koch published a landmark paper in Biometrics that gave researchers a shared vocabulary for reading kappa: below 0 poor, 0.00 to 0.20 slight, 0.21 to 0.40 fair, 0.41 to 0.60 moderate, 0.61 to 0.80 substantial, 0.81 to 1.00 almost perfect. It is still the most cited guide, and it is why a kappa figure carries real weight in a methodology chapter.",
      "Your results screen shows Cohen's kappa and percent agreement for your transcript, the number of themes, and every passage where the two readings disagreed, so you can review them yourself. If your transcript is short (fewer than 30 coded units), you are told the result is unstable. The number is reported honestly, because a result you can defend is worth more than one that only looks good.",
    ] },
    { heading: "The method behind the themes", paragraphs: [
      "The analysis follows inductive thematic analysis (Braun and Clarke, 2006), the most widely cited approach in qualitative research. Themes come from what your participants said, not from a template, and each is supported with quotations from your transcript.",
    ] },
    { heading: "What you receive", bullets: [
      "Themes and sub-themes with definitions",
      "A codebook with every theme and its details",
      "Supporting quotations assigned to each theme",
      "The inter-coder reliability result: kappa, percent agreement and the disagreement list",
      "A detailed analysis document with tables, interpretation and discussion",
      "Quality references to support your discussion",
      "Chapter 5 and Defense Prep: recommendations, plus likely questions with answers, in one Word download",
    ] },
    { heading: "Who it is for", paragraphs: [
      "Postgraduate and doctoral researchers, lecturers and supervisors, NGOs and development agencies, health and education institutions, policy and communication researchers, and businesses analysing interviews, focus groups and open-ended feedback.",
    ] },
    { heading: "The price is the point", paragraphs: [
      "Traditionally this means weeks of work: coding by hand, recruiting a second coder, building a codebook and paying for specialist software or an analyst. Vertex delivers the full package at a price you see before anything starts, with Chapter 5 and Defense Prep included.",
    ] },
    { heading: "Good to know", paragraphs: [
      "Kappa measures how consistently the transcript was coded. It does not by itself prove your themes are the right ones. Review the disagreements, check the quotes against your transcript, and keep your own judgment at the centre of the analysis. Please check the citations (Cohen, 1960; Landis and Koch, 1977; Braun and Clarke, 2006) against the originals before you cite them.",
    ] },
  ],
};
