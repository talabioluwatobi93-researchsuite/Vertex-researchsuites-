import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static must not be bundled: its binary path is resolved at runtime
  serverExternalPackages: ["ffmpeg-static"],
  // ship the ffmpeg binary with the two routes that run it
  outputFileTracingIncludes: {
    "/api/voice-transcription/probe": ["./node_modules/ffmpeg-static/**/*"],
    "/api/voice-transcription/gemini-part": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
