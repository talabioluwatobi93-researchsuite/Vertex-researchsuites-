export type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type PriceItem = { label: string; key: string; per?: string };
export type Feature = {
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  button: string;
  prices: PriceItem[];
  sections: Section[];
};
