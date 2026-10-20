"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function MaintenanceGate({ flagKey, children }: { flagKey: string; children: ReactNode }) {
  const [state, setState] = useState<"loading" | "on" | "off">("loading");

  useEffect(() => {
    let active = true;
    async function check() {
      let next: "on" | "off" = "on";
      try {
        const { data } = await supabase.from("feature_flags").select("enabled").eq("key", flagKey).maybeSingle();
        if (data && data.enabled === false) next = "off";
      } catch {}
      if (active) setState(next);
    }
    check();
    return () => { active = false; };
  }, [flagKey]);

  if (state === "loading") return <div style={{ padding: 24, color: "#777777", fontSize: 14 }}>Loading...</div>;
  if (state === "on") return <>{children}</>;

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 480, margin: "80px auto 0", background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 14, padding: 24, textAlign: "center" }}>
        <h1 style={{ color: "#333333", fontSize: 20, fontWeight: 700, margin: 0 }}>Feature currently on maintenance</h1>
        <p style={{ color: "#777777", fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
          Please check back. Thank you for choosing Vertex-researchsuite.
        </p>
        <Link href="/dashboard" style={{ display: "inline-block", marginTop: 14, padding: "10px 18px", borderRadius: 10, background: "#D4AF37", color: "#FFFFFF", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
