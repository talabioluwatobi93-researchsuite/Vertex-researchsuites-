"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Purchase = {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  created_at: string;
};

const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#777777";
const BORDER = "#EEEEEE";

function statusColor(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "success" || s === "successful" || s === "completed") return GOLD;
  if (s === "pending") return "#E08A00";
  return MUTED;
}

function formatExactDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchPurchases() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("id, description, amount, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        console.error("Purchases fetch error:", error.message);
      } else {
        setPurchases(data || []);
      }
      setLoading(false);
    }

    fetchPurchases();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Link href="/dashboard" style={{ color: MUTED, fontSize: 14, textDecoration: "none" }}>
          ‹ Back to Dashboard
        </Link>
        <h1 style={{ color: DARK, fontSize: 22, fontWeight: 700, margin: "16px 0" }}>
          Purchase History
        </h1>

        {loading ? (
          <p style={{ color: MUTED, fontSize: 14 }}>Loading...</p>
        ) : purchases.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 14 }}>No purchases yet.</p>
        ) : (
          purchases.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                background: "#FFFFFF",
                border: `1px solid ${BORDER}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ color: DARK, fontSize: 15, fontWeight: 600 }}>
                  {p.description || "Feature purchase"}
                </div>
                <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
                  {formatExactDateTime(p.created_at)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: DARK, fontSize: 15, fontWeight: 700 }}>
                  {"\u20A6"}{Number(p.amount).toLocaleString()}
                </div>
                <div
                  style={{
                    color: statusColor(p.status),
                    fontSize: 13,
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {p.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
