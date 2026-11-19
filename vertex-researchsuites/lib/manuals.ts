export type Block =
  | { t: "p"; text: string }
  | { t: "h"; step?: string; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "note"; kind: "tip" | "warn" | "info"; title: string; text: string }
  | { t: "table"; head: string[]; rows: string[][] };

export type ManualContent = { intro: string; fee?: string; blocks: Block[] };

export type ManualEntry = {
  slug: string;
  label: string;
  blurb: string;
  pdf: string;
  hasPage: boolean;
};

export const MANUALS_LIST: ManualEntry[] = [
  { slug: "proposals", label: "Get Research Topics & Proposals", blurb: "Tailored to your course and institution", pdf: "research-topics-proposals.pdf", hasPage: false },
  { slug: "pilot-study", label: "Pilot Study & Reliability Test", blurb: "Check how reliable your pilot survey results are", pdf: "Pilot_Study_Reliability_Test_User_Manual_SHORT.pdf", hasPage: true },
  { slug: "quantitative-analysis", label: "Quantitative Data Analysis", blurb: "Turn your survey data into APA-styled results", pdf: "Quantitative_Data_Analysis_User_Manual.pdf", hasPage: true },
  { slug: "data-cleaning", label: "Quantitative Data Cleaning", blurb: "Turn word answers into numbers for analysis", pdf: "Quantitative_Data_Cleaning_User_Manual.pdf", hasPage: true },
  { slug: "report-restyle", label: "Restyle Your Report", blurb: "Convert your tables and writing to any citation style", pdf: "Restyle_Your_Report_User_Manual.pdf", hasPage: false },
  { slug: "qualitative-analysis", label: "Qualitative Data Analysis", blurb: "Turn interview transcripts into themed, quoted findings", pdf: "Qualitative_Data_Analysis_User_Manual.pdf", hasPage: false },
  { slug: "voice-transcription", label: "Voice Transcription & Analysis", blurb: "Upload interview audio, get transcript + notes", pdf: "Voice_Transcription_Analysis_User_Manual.pdf", hasPage: false },
];
