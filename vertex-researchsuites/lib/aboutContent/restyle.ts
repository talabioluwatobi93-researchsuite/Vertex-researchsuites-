import type { Feature } from "./types";
export const restyle: Feature = {
  slug: "report-restyle",
  title: "Restyle Your Report",
  tagline: "Same research. The right citation style.",
  summary: "Upload a Word report and get it back in your chosen citation style.",
  button: "Restyle my report",
  prices: [{ label: "Per report", key: "report_restyle" }],
  sections: [
    { heading: "Every department and journal wants something different", paragraphs: [
      "Supervisors, journals, publishers and organisations each ask for a different style. Rewriting every in-text citation and reference by hand takes hours, and it is the last thing you want to do before a deadline. Upload your Word report and Vertex restyles it to the citation style you choose.",
    ] },
    { heading: "How it works", bullets: [
      "Upload your report as a Word file (.docx, up to 4 MB), tables included.",
      "Choose from 10 styles: APA 7, APA 6, MLA 9, Chicago 17, Harvard, Vancouver, IEEE, Turabian 9, OSCOLA or AMA.",
      "See the price, then confirm.",
      "Download a new Word file.",
    ] },
    { heading: "What stays safe", bullets: [
      "Every table, caption and interpretation is brought into your chosen style.",
      "Your charts and numbers stay exactly as they are. Nothing in your results changes.",
    ] },
    { heading: "Who it is for", paragraphs: [
      "Students moving between a department and a journal, researchers resubmitting to a new publisher, lecturers, consultants, and organisations that publish reports in a house style.",
    ] },
    { heading: "Good to know", paragraphs: [
      "Open the new file and check your reference list and in-text citations against your institution's guide before you submit.",
    ] },
  ],
};
