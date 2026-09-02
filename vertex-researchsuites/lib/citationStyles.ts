export const CITATION_STYLES = [
  { value: "APA7", label: "APA 7 — American Psychological Association 7th Edition" },
  { value: "APA6", label: "APA 6 — American Psychological Association 6th Edition" },
  { value: "MLA9", label: "MLA 9 — Modern Language Association 9th Edition" },
  { value: "Chicago17", label: "Chicago 17 — Chicago Manual of Style 17th Edition" },
  { value: "Harvard", label: "Harvard — Harvard Referencing System" },
  { value: "Vancouver", label: "Vancouver — Vancouver Biomedical Style" },
  { value: "IEEE", label: "IEEE — Institute of Electrical and Electronics Engineers" },
  { value: "Turabian9", label: "Turabian 9 — Turabian 9th Edition" },
  { value: "OSCOLA", label: "OSCOLA — Oxford Standard for Citation of Legal Authorities" },
  { value: "AMA", label: "AMA — American Medical Association" },
] as const;

export type CitationStyleValue = typeof CITATION_STYLES[number]["value"];
