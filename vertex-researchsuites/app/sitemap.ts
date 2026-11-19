import type { MetadataRoute } from "next";

const BASE = "https://www.vertex-researchsuite.com";

const PATHS = [
  "",
  "/manuals",
  "/manuals/proposals",
  "/manuals/pilot-study",
  "/manuals/quantitative-analysis",
  "/manuals/data-cleaning",
  "/manuals/report-restyle",
  "/manuals/qualitative-analysis",
  "/manuals/voice-transcription",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({
    url: BASE + p,
    lastModified: new Date(),
  }));
}
