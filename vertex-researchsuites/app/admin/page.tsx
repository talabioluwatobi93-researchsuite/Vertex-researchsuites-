"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const GOLD = "#D4AF37";
const DARK = "#333333";
const BG = "#F9F9F9";
const MUTED = "#777777";

type AccessStatus = "loading" | "denied" | "granted";

export default function AdminPage() {
  const [status, setStatus] = useState<AccessStatus>("loading");

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) setStatus("denied");
        return;
      }

      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setStatus("denied");
      } else {
        setStatus("granted");
      }
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: MUTED,
          fontSize: 14,
        }}
      >
        Checking access…
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ color: DARK, fontSize: 22, fontWeight: 700, margin: 0 }}>
          Access Denied
        </h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 8, maxWidth: 320 }}>
          You don't have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: 24 }}>
      <h1 style={{ color: DARK, fontSize: 22, fontWeight: 700, margin: 0 }}>
        Admin Overview
      </h1>
      <p style={{ color: MUTED, fontSize: 14, marginTop: 8 }}>
        You're in. Dashboard sections coming next.
      </p>
      <div
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 12,
          background: "#FFFFFF",
          border: `1px solid ${GOLD}`,
          color: DARK,
          fontSize: 13,
        }}
      >
        This page will soon show revenue, feature usage, user lookup, billboard/pricing management, and API credit balances.
      </div>
    </div>
  );
}
