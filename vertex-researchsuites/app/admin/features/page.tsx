"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import FeatureFlagsManager from "@/components/admin/FeatureFlagsManager";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function AdminFeaturesPage() {
  const [status, setStatus] = useState<"checking" | "granted" | "denied">("checking");

  useEffect(() => {
    async function run() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus("denied"); return; }
      const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      setStatus(error || !data ? "denied" : "granted");
    }
    run();
  }, []);

  if (status === "checking") return <div style={{ padding: 24, color: "#777777" }}>Checking access...</div>;
  if (status === "denied") return <div style={{ padding: 24, color: "#A33" }}>Access denied.</div>;

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: "#333333", fontSize: 22, fontWeight: 700, margin: 0 }}>Features</h1>
        <p style={{ color: "#777777", fontSize: 13, marginBottom: 14 }}>
          Switch a feature off to show students the maintenance message. It applies the next time they open it.
        </p>
        <FeatureFlagsManager supabase={supabase} />
      </div>
    </div>
  );
}
