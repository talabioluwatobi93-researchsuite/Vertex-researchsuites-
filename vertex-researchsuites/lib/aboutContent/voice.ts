import type { Feature } from "./types";
export const voice: Feature = {
  slug: "voice-transcription",
  title: "Voice Transcription & Analysis",
  tagline: "Never type out an interview again, even when it is in Yoruba, Hausa, Igbo or Pidgin.",
  summary: "Transcripts for African and global languages, with code-switching and speaker separation.",
  button: "Transcribe my audio",
  prices: [
    { label: "African languages", key: "voice_african_per_min", per: "per minute" },
    { label: "Global languages", key: "voice_global_per_min", per: "per minute" },
  ],
  sections: [
    { heading: "Built for the way people really speak", paragraphs: [
      "One hour of interview audio takes a person eight to twelve hours to transcribe, and much longer when speakers switch between a local language and English in the same sentence. Most tools collapse on exactly that. Vertex was built for it.",
    ] },
    { heading: "Real support for African languages", paragraphs: [
      "Dedicated support for more than 30 African languages and dialects, including Yoruba, Igbo, Hausa, Nigerian Pidgin, Akan, Twi, Wolof, Swahili, Amharic, Kinyarwanda, Luganda, Zulu, Xhosa, Shona, Oromo, Tigrinya and the main varieties of Fulani, including speech mixed with English. Very few transcription tools handle local indigenous languages. Vertex has a dedicated path for them.",
      "Tell Vertex what your speakers mix, for example 'Nigerian Pidgin mixed with Yoruba and English', and the transcript follows the switches. For global languages, you can leave the language on auto-detect.",
    ] },
    { heading: "What you get", bullets: [
      "A downloadable transcript with detailed documentation",
      "Speaker separation, so you know who said what",
      "A publication-ready document with corrected diacritics and tone marks where the context makes them clear",
      "Local terms and mixed phrases shown as Original Text [Translation/Meaning]",
      "More than 65 global languages, from English, French and Spanish to Mandarin, Hindi and Japanese",
    ] },
    { heading: "Upload guide", bullets: [
      "African languages: for best results keep each upload under 20 minutes.",
      "Global languages, one speaker: up to about 1 hour per upload.",
      "More than one speaker: up to about 30 minutes per upload.",
      "Longer interview? Split it and upload the parts. You pay per minute, so splitting costs the same.",
    ] },
    { heading: "Record it right, and the transcript will be right", bullets: [
      "Record in a quiet room. Close windows, switch off fans and TVs, and avoid markets and traffic.",
      "Keep the phone or microphone close, about a hand's width from each speaker, and do not move it.",
      "Speak clearly, at a steady pace and a good volume. Do not trail off at the end of sentences.",
      "One person at a time. Overlapping voices are the hardest part for any engine.",
      "Say names and technical terms slowly, and spell unusual ones out.",
      "Do a 10-second test first and play it back. If you cannot hear every word easily, record again.",
      "Upload the original recording, not a copy forwarded through a chat app, which compresses the sound.",
    ] },
    { heading: "Fair pricing, no surprises", paragraphs: [
      "You pay per minute of audio, rounded up to the next minute, with separate rates for African and global languages. You see the exact amount and confirm it before anything is processed.",
      "Then go further: take your transcript into Qualitative Data Analysis and go from recording to themes and codebook in one platform.",
    ] },
    { heading: "Good to know", paragraphs: [
      "Check names, technical terms and heavily accented passages against your recording before you quote from the transcript.",
    ] },
  ],
};
