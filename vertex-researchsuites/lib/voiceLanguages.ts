// Language list for the voice transcription page (Appendix A of the master plan).
// Data only. "code" is the BCP-47 tag sent to Gemini; null = let Gemini auto-detect.
// Only tags seen in Google's own docs are filled in. Add more only after testing them.

export type LanguageOption = {
  value: string;
  label: string;
  code: string | null;
  experimental: boolean;
};

export type LanguageGroup = {
  label: string;
  options: LanguageOption[];
};

export const AUTO_LANGUAGE_VALUE = "auto";

export const LANGUAGE_NOTE =
  "Mixed-language speech (for example Nigerian Pidgin with Yoruba and English) is expected. " +
  "Pick the main language, or leave Auto-detect and describe the mix in the hint below. " +
  "Languages marked experimental may be transcribed poorly.";

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function opt(label: string, code: string | null = null, experimental = false): LanguageOption {
  return { value: slug(label), label, code, experimental };
}

export const LANGUAGE_GROUPS: LanguageGroup[] = [
  {
    label: "A. Nigerian languages",
    options: [
      opt("Nigerian English"),
      opt("Nigerian Pidgin English", null, true),
      opt("Yoruba", null, true),
      opt("Hausa", "ha-NG"),
      opt("Igbo", null, true),
    ],
  },
  {
    label: "B. Other African languages",
    options: [
      opt("Afrikaans (South Africa)"),
      opt("Amharic (Ethiopia)"),
      opt("Kabuverdianu (Cape Verde)"),
      opt("Lingala (Congo)"),
      opt("Malagasy (Madagascar)"),
      opt("Oromo (Ethiopia)"),
      opt("Somali (Somalia, Kenya)"),
      opt("Swahili (Kenya, Tanzania, Uganda)", "sw-KE"),
      opt("Wolof (Senegal)"),
      opt("Xhosa (South Africa)"),
      opt("Zulu (South Africa)"),
    ],
  },
  {
    label: "C. Americas & Europe",
    options: [
      opt("English (US, UK, Australian, Canadian, Caribbean)"),
      opt("French (France, Canada, African dialects)"),
      opt("Spanish (Spain, Latin America)"),
      opt("Portuguese (Portugal, Brazil)"),
      opt("German"),
      opt("Italian"),
      opt("Dutch"),
      opt("Russian"),
      opt("Polish"),
      opt("Swedish"),
      opt("Danish"),
      opt("Finnish"),
      opt("Norwegian"),
      opt("Greek"),
      opt("Turkish"),
      opt("Ukrainian"),
      opt("Czech"),
      opt("Hungarian"),
      opt("Romanian"),
      opt("Bulgarian"),
      opt("Croatian"),
      opt("Serbian"),
      opt("Slovak"),
      opt("Slovenian"),
      opt("Catalan"),
      opt("Galician"),
      opt("Basque"),
      opt("Albanian"),
      opt("Macedonian"),
      opt("Estonian"),
      opt("Latvian"),
      opt("Lithuanian"),
      opt("Icelandic"),
      opt("Maltese"),
      opt("Haitian Creole"),
    ],
  },
  {
    label: "D. Asia & Middle East",
    options: [
      opt("Mandarin Chinese (Simplified & Traditional)"),
      opt("Cantonese"),
      opt("Japanese"),
      opt("Korean"),
      opt("Hindi (India)"),
      opt("Bangla / Bengali (Bangladesh, India)"),
      opt("Urdu (Pakistan, India)"),
      opt("Punjabi"),
      opt("Gujarati"),
      opt("Marathi"),
      opt("Tamil"),
      opt("Telugu"),
      opt("Kannada"),
      opt("Malayalam"),
      opt("Arabic (Standard, Egyptian, Gulf, Levantine, North Africa)"),
      opt("Persian / Farsi"),
      opt("Hebrew"),
      opt("Indonesian"),
      opt("Malay"),
      opt("Tagalog / Filipino"),
      opt("Vietnamese"),
      opt("Thai"),
      opt("Burmese"),
      opt("Khmer"),
      opt("Lao"),
      opt("Sinhala"),
      opt("Nepali"),
      opt("Kazakh"),
      opt("Uzbek"),
    ],
  },
];

const ALL_OPTIONS: LanguageOption[] = LANGUAGE_GROUPS.reduce(
  (acc: LanguageOption[], g) => acc.concat(g.options),
  []
);

export function findLanguage(value: string): LanguageOption | undefined {
  return ALL_OPTIONS.find((o) => o.value === value);
}

// Codes to send to Gemini for a dropdown value. Empty array = auto-detect.
export function languageCodesFor(value: string): string[] {
  const o = findLanguage(value);
  return o && o.code ? [o.code] : [];
}

export function optionText(o: LanguageOption): string {
  return o.experimental ? o.label + " (experimental)" : o.label;
}
