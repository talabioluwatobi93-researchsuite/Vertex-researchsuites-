"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const DARK = "#333333";
const MUTED = "#777777";
const BORDER = "#EEEEEE";

export default function PurchaseHistory() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { count: c, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "success");
      if (!active) return;
      if (error) {
        console.error("PurchaseHistory count error:", error.message);
        return;
      }
      setCount(c ?? 0);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const label =
    count === null ? "View all" : count + " receipt" + (count === 1 ? "" : "s");

  return (
    <div
      onClick={() => router.push("/purchases")}
      style={{ background: "#FFFFFF", border: "1px solid " + BORDER, borderRadius: 12, padding: 16, cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: DARK, fontSize: 15, fontWeight: 600 }}>Purchase History</span>
        <span style={{ color: MUTED, fontSize: 13 }}>{label} ›</span>
      </div>
    </div>
  );
}
