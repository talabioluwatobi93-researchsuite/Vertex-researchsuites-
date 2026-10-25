import type { Feature } from "./types";
export const pilot: Feature = {
  slug: "pilot-study",
  title: "Pilot Study & Reliability Test",
  tagline: "Test your questionnaire before it tests you.",
  summary: "Cronbach's alpha for every construct, with a written interpretation and a Word report.",
  button: "Start my pilot study",
  prices: [{ label: "Per pilot study session", key: "pilot_study" }],
  sections: [
    { heading: "Can I trust this instrument?", paragraphs: [
      "Every serious survey rests on one question: can I trust this instrument? A questionnaire can look flawless on paper and still fail in the field, with items that do not measure the same idea, a reverse-worded question that confuses respondents, or a scale that behaves differently from how you designed it.",
      "Finding that out after 400 responses is expensive. Finding it out in a pilot costs almost nothing. Whether you are a postgraduate preparing a main study, a lecturer building a teaching instrument, a market researcher launching a customer survey or an organisation measuring staff satisfaction, a reliability result is the first evidence reviewers, supervisors and clients ask for.",
    ] },
    { heading: "How it works", bullets: [
      "See the price first. Pay, and your pilot begins.",
      "Upload your pilot responses as an Excel or CSV file.",
      "Group your items under the construct each one measures, and set your scale range, for example 1 to 5.",
      "Mark any reverse-worded items so they are scored correctly.",
      "Get your results on screen, then download your Word report.",
    ] },
    { heading: "What you receive", bullets: [
      "Cronbach's alpha for every construct, shown to 3 decimal places",
      "A combined alpha across all your scale sections",
      "The number of valid respondents behind each result",
      "A written interpretation for each construct, judged against recognised thresholds (0.70 or above is acceptable)",
      "A Word report you can adapt for your methodology chapter or technical report",
    ] },
    { heading: "Why people choose it", bullets: [
      "Reverse-coded items are handled for you. This is where most hand calculations go wrong.",
      "Each construct is tested on its own, so unrelated items are not forced into one meaningless coefficient.",
      "You get words, not just numbers.",
      "If your data is missing or incomplete, you get a clear message, not an invented report.",
    ] },
    { heading: "Good to know", paragraphs: [
      "Alpha shows how consistently your items measure together. Reviewers also look for content and construct validity, which come from your instrument design and the literature, so cite both.",
    ] },
  ],
};
