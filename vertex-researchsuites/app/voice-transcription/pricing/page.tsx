"use client";

import FeaturePackage from "@/components/FeaturePackage";

export default function VoicePricingPage() {
  return (
    <FeaturePackage
      title="Voice Transcription & Analysis"
      intro="Upload your audio for appropriate and accurate transcription."
      items={[
        "You get a downloadable transcript of the audio, and detailed documentation of it is provided by our engine model",
        "A rich quality of languages across Africa, with code switching from various languages to global languages across the world",
        "Supporting 80+ languages, with proper annotation, spellings and diarization",
      ]}
      featureKey="voice_transcription"
      nextHref="/voice-transcription"
    />
  );
}
