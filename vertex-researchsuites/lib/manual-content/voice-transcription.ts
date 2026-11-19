import type { ManualContent } from "../manuals";

export const content: ManualContent = {
  intro: "A short guide to turning your audio recordings into written transcripts and detailed interpretive notes.",
  fee: "\u20A650 per minute (African languages), \u20A630 per minute (other languages). Charged per minute, rounded up.",
  blocks: [
    { t: "h", text: "About this feature" },
    { t: "p", text: "The Voice Transcription & Analysis feature converts your audio recordings, such as interviews and voice notes, into written text. For every recording you receive a downloadable transcript with speakers labelled, and detailed interpretive notes on its themes, tensions, tone and follow-up points." },
    { t: "p", text: "It supports African languages (including speech that mixes an African language with English) and global languages: more than 80 languages, with proper annotation, spelling and speaker separation." },
    { t: "table", head: ["Engine", "Price", "Best for"], rows: [
      ["African languages", "\u20A650 per minute", "Yoruba, Igbo, Hausa, Pidgin and other African languages, including speech mixed with English"],
      ["Global languages", "\u20A630 per minute", "Other languages across the world"]
    ] },
    { t: "note", kind: "info", title: "You are not charged immediately", text: "Charges are per minute of audio, rounded up to the next minute. You see the exact amount and confirm it before anything is charged." },
    { t: "h", text: "Before you start" },
    { t: "ol", items: [
      "Have your audio file ready on your device. Spoken interviews and voice notes work best. Songs or music will likely transcribe poorly.",
      "Keep each recording short (see the note below for the current limit).",
      "Know the language spoken. For African languages you must choose it yourself, as there is no auto-detect.",
      "Make sure your wallet balance can pay for your minutes, and use a strong internet connection."
    ] },
    { t: "note", kind: "info", title: "Current length limit", text: "For now, an African-languages upload should be about 3 minutes or less. The global languages box shows its own limit. A bigger upgrade is coming soon." },
    { t: "h", text: "Step-by-step guide" },
    { t: "h", step: "STEP 1", text: "Read the preview and accept" },
    { t: "p", text: "The preview page shows what you get and the price per minute. You are not charged yet. Tap Accept and continue." },
    { t: "h", step: "STEP 2", text: "Choose your engine" },
    { t: "p", text: "The next page has two boxes: African languages (top) and Other languages (global) (bottom). Use the box that matches your recording." },
    { t: "h", step: "STEP 3", text: "Find your audio file" },
    { t: "p", text: "Tap Tap here to choose an audio file in that box and select your recording from your device. The file name then appears in the box." },
    { t: "h", step: "STEP 4", text: "Choose the language" },
    { t: "p", text: "Under Language spoken (African), pick the language. Entries marked + English are for speech that mixes the language with English, for example Yoruba + English. For global languages, pick the Audio language or leave Auto-detect, and optionally add a Language hint, for example Nigerian Pidgin mixed with Yoruba and English." },
    { t: "note", kind: "tip", title: "Optional: Detect speakers more accurately (beta)", text: "In the African languages box, this uses a separate speaker-detection service. Use it for non-sensitive recordings while it is in beta. If it fails, the normal method runs instead." },
    { t: "h", step: "STEP 5", text: "Upload and confirm the price" },
    { t: "p", text: "Tap Upload & Transcribe and wait in the app. It shows the total minutes and the price (minutes x rate). If you accept, the amount is deducted from your wallet and your request continues." },
    { t: "note", kind: "info", title: "Example", text: "A recording of 2 min 36 s rounds up to 3 minutes. African languages: 3 x \u20A650 = \u20A6150. Global languages: 3 x \u20A630 = \u20A690. The app always shows your exact amount before you confirm." },
    { t: "note", kind: "warn", title: "Stay on the page while the feature is working", text: "Do not leave the tab, minimise the app or move to another part of the application while your audio is uploading and being transcribed. Wait until your results are ready before you leave or log out." },
    { t: "h", text: "Your results" },
    { t: "p", text: "When processing is complete you receive two documents, dated with the day of transcription: the transcript (the written text, with each voice labelled, for example Speaker 1) and the interpretive notes (a detailed analysis for qualitative research)." },
    { t: "p", text: "The notes have five parts: Transcript Language & Context; Key Themes with Verbatim Quotes; Notable Contradictions or Tensions; Emotional Tone and Emphasis; and Gaps and Points for Follow-Up." },
    { t: "h", text: "Quick checklist" },
    { t: "ul", items: [
      "I accepted the preview and chose the engine that matches my recording.",
      "My recording is within the current limit.",
      "I selected the correct language, including + English if the speaker mixes languages.",
      "I checked the total minutes and the price before I confirmed.",
      "I stayed on the page until my results were ready."
    ] }
  ],
};
