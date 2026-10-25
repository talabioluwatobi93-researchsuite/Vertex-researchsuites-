import type { Feature } from "./types";
export const proposals: Feature = {
  slug: "proposals",
  title: "Research Topics & Proposals",
  tagline: "From a research interest to a full proposal draft, in one sitting.",
  summary: "Get 5 tailored topic suggestions, then a full proposal for the one you choose.",
  button: "Start with 5 topics",
  prices: [
    { label: "5 topic suggestions", key: "research_topics" },
    { label: "Full proposal for your chosen topic", key: "research_proposal_full" },
  ],
  sections: [
    { heading: "Start with something real", paragraphs: [
      "Staring at a blank page is where many projects lose weeks. Vertex gives you topic suggestions you can discuss and a structured proposal built around the one you choose, so you can walk into your supervisor's office, your team meeting or your funder's call with something real on the table.",
      "It works for students, postgraduate and doctoral researchers, lecturers, institutions, organisations and professionals planning a study.",
    ] },
    { heading: "How it works", bullets: [
      "Enter your institution, course and department.",
      "Choose Pure (basic) research to build theory and understanding, or Applied research to tackle a real-world problem that you describe.",
      "Pick your citation style from 10 options. APA 7 is the default.",
      "See the fee first. Accept it, and your 5 topic suggestions are generated. Choose the one that fits.",
      "A full proposal is written for that topic and saved so you can download it.",
    ] },
    { heading: "What your proposal contains", bullets: [
      "Background of the Study, with its research gap",
      "Statement of the Problem",
      "Objectives: one general and three to four specific",
      "Research Questions: three to four, each with a short explanation",
      "Significance of the Study",
      "Theoretical Framework: two theories, each named and justified for your course and topic",
      "Research Methodology: design, population and sample, data collection and analysis approach",
      "Sampling Procedure, set out stage by stage",
      "References from the Crossref and OpenAlex scholarly registers, in your chosen style",
    ] },
    { heading: "Why people choose it", bullets: [
      "Objectives, questions and methodology are written to connect with each other, which is what supervisors and reviewers look for.",
      "You see the fee before anything is generated.",
      "Pure and Applied research each get their own path.",
    ] },
    { heading: "Good to know", paragraphs: [
      "Treat the output as a strong first draft. Check every reference against the original source and confirm your topic with your supervisor or team. A stated research gap is not proof that no earlier study exists.",
    ] },
  ],
};
