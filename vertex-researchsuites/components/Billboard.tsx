"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#777777";
const BORDER = "#EEEEEE";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type BillboardSlide = {
  id: string;
  imageUrl?: string; // optional image; falls back to emoji if not set
  emoji?: string;
  title: string;
  text: string;
};

// Hardcoded fallback — used only if the billboard_slides table fetch
// fails or returns no active rows, so the billboard never goes blank.
const FALLBACK_SLIDES: BillboardSlide[] = [
  {
    id: "welcome",
    emoji: "🚀",
    title: "Welcome to Vertex ResearchSuite",
    text: "Your all-in-one companion for research, writing, and analysis — built to make your academic journey easier.",
  },
  {
    id: "quality",
    emoji: "⭐",
    title: "Quality You Can Trust",
    text: "Every tool here is built around accuracy and reliability — because your research deserves nothing less.",
  },
];

const SLIDE_INTERVAL_MS = 4500;

export default function Billboard() {
  const [slides, setSlides] = useState<BillboardSlide[]>(FALLBACK_SLIDES);
  const [activeIndex, setActiveIndex] = useState(0);

  // Fetch active slides from Supabase, ordered by sort_order.
  // Falls back to FALLBACK_SLIDES on error or empty result.
  useEffect(() => {
    let isMounted = true;

    async function loadSlides() {
      const { data, error } = await supabase
        .from("billboard_slides")
        .select("id, title, text, icon, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!isMounted) return;

      if (error || !data || data.length === 0) {
        setSlides(FALLBACK_SLIDES);
        return;
      }

      const mapped: BillboardSlide[] = data.map((row) => ({
        id: row.id,
        title: row.title,
        text: row.text ?? "",
        emoji: row.icon ?? undefined,
        imageUrl: row.image_url ?? undefined,
      }));

      setSlides(mapped);
    }

    loadSlides();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides]);

  return (
    <div style={{ padding: "0 20px 24px", marginTop: 8 }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          background: "#FFFFFF",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            transform: `translateX(-${activeIndex * 100}%)`,
            transition: "transform 0.6s ease",
          }}
        >
          {slides.map((slide) =>
            slide.imageUrl ? (
              <div
                key={slide.id}
                style={{
                  minWidth: "100%",
                  aspectRatio: "16 / 7",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.imageUrl}
                  alt={slide.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            ) : (
              <div
                key={slide.id}
                style={{
                  minWidth: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    minWidth: 64,
                    borderRadius: 14,
                    overflow: "hidden",
                    background:
                      "linear-gradient(135deg, #F5D485 0%, #D4AF37 45%, #9C7A16 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  <span>{slide.emoji}</span>
                </div>

                <div>
                  <div style={{ color: DARK, fontSize: 15, fontWeight: 700 }}>
                    {slide.title}
                  </div>
                  <div style={{ color: MUTED, fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>
                    {slide.text}
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {slides.length > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "6px",
              paddingTop: "12px",
            }}
          >
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                style={{
                  width: activeIndex === i ? "18px" : "6px",
                  height: "6px",
                  borderRadius: "3px",
                  backgroundColor: activeIndex === i ? GOLD : "#E5D9B0",
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
