// African languages for the Intron engine (docs.voice.intron.io, Supported Languages).
// Data only. "code" is sent as use_language_asr_input. Intron needs a language code,
// so there is no auto-detect here. "codeSwitched" entries are Intron's language-plus-English
// models, meant for speech that mixes the language with English.

export type IntronLanguageOption = {
  value: string;
  label: string;
  code: string;
  codeSwitched: boolean;
};

export type IntronLanguageGroup = {
  label: string;
  options: IntronLanguageOption[];
};

export const INTRON_LANGUAGE_NOTE =
  "Pick the language that is spoken. Entries marked + English are for speech that mixes the language with English. " +
  "A language must be chosen, there is no auto-detect.";

function mixed(label: string, code: string): IntronLanguageOption {
  return { value: code, label: label, code: code, codeSwitched: true };
}

function single(label: string, code: string): IntronLanguageOption {
  return { value: code, label: label, code: code, codeSwitched: false };
}

export const INTRON_LANGUAGE_GROUPS: IntronLanguageGroup[] = [
  {
    label: "A. African languages mixed with English",
    options: [
      mixed("Yoruba + English", "yo"),
      mixed("Igbo + English", "ig"),
      mixed("Hausa + English", "ha"),
      mixed("Nigerian Pidgin + English", "pcm"),
      mixed("Afrikaans + English", "af"),
      mixed("Akan + English", "ak"),
      mixed("Amharic + English", "am"),
      mixed("Kinyarwanda + English + French", "rw"),
      mixed("Luganda + English", "lg"),
      mixed("Swahili + English", "sw"),
      mixed("Wolof + English", "wo"),
      mixed("Zulu + English", "zu"),
    ],
  },
  {
    label: "B. Other African languages",
    options: [
      single("Arabic", "ar"),
      single("Bemba", "bem"),
      single("Dholuo (Luo)", "luo"),
      single("Ga", "gaa"),
      single("Kanuri", "kr"),
      single("Kikuyu", "ki"),
      single("Northern Sotho", "nso"),
      single("Nupe", "nup"),
      single("Nyankole", "nyn"),
      single("Oromo", "om"),
      single("Shona", "sn"),
      single("Sotho", "st"),
      single("Tigrinya", "ti"),
      single("Tswana", "tn"),
      single("Twi", "tw"),
      single("Xhosa", "xh"),
    ],
  },
  {
    label: "C. Fulani",
    options: [
      single("Fulani", "ff"),
      single("Fulani (Pulaar)", "fuc"),
      single("Fulani (Pular)", "fuf"),
      single("Fulani (Adamawa Fulfulde)", "fub"),
      single("Fulani (Nigerian Fulfulde)", "fuv"),
      single("Fulani (Central-Eastern Niger Fulfulde)", "fuq"),
      single("Fulani (Borgu Fulfulde)", "fue"),
      single("Fulani (Maasina Fulfulde)", "ffm"),
    ],
  },
];

export const INTRON_ALL_OPTIONS: IntronLanguageOption[] = INTRON_LANGUAGE_GROUPS.reduce(
  (acc: IntronLanguageOption[], g) => acc.concat(g.options),
  []
);

export function findIntronLanguage(value: string): IntronLanguageOption | undefined {
  return INTRON_ALL_OPTIONS.find((o) => o.value === value);
}

// Code to send to Intron for a dropdown value. null = unknown value (do not send).
export function intronCodeFor(value: string): string | null {
  const o = findIntronLanguage(value);
  return o ? o.code : null;
}
