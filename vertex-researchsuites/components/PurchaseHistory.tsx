"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
const BG = "#F9F9F9";
const MUTED = "#777777";
const BORDER = "#EEEEEE";

function statusColor(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "success" || s === "successful" || s === "completed") return GOLD;
  if (s === "pending") return "#E08A00"; // orange
  return MUTED; // gray fallback for failed/other
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

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

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
        console.error("PurchaseHistory fetch error:", error.message);
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

  const latest = purchases.slice(0, 3);

  return (
    <>
      {/* Dashboard Card */}
      <div
        onClick={() => router.push('/purchases')}
        style={{
          background: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 16,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h3 style={{ color: DARK, fontSize: 16, fontWeight: 600, margin: 0 }}>
            Purchase History
          </h3>
          <span style={{ color: MUTED, fontSize: 13 }}>View all →</span>
        </div>

        {loading ? (
          <p style={{ color: MUTED, fontSize: 14 }}>Loading…</p>
        ) : latest.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 14 }}>No purchases yet.</p>
        ) : (
          latest.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <div>
                <div style={{ color: DARK, fontSize: 14, fontWeight: 500 }}>
                  {p.description || "Feature purchase"}
                </div>
                <div style={{ color: MUTED, fontSize: 12 }}>
                  {formatExactDateTime(p.created_at)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: DARK, fontSize: 14, fontWeight: 600 }}>
                  ₦{Number(p.amount).toLocaleString()}
                </div>
                <div style={{ color: statusColor(p.status), fontSize: 12 }}>
                  {p.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Full-screen Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: BG,
            zIndex: 1000,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: `1px solid ${BORDER}`,
              background: "#FFFFFF",
              position: "sticky",
              top: 0,
            }}
          >
            <h2 style={{ color: DARK, fontSize: 18, fontWeight: 700, margin: 0 }}>
              Purchase History
            </h2>
            <button
              onClick={() => setModalOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: MUTED,
                fontSize: 20,
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div style={{ padding: 20 }}>
            {purchases.length === 0 ? (
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
                    borderRadius: 10,
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
                      ₦{Number(p.amount).toLocaleString()}
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
      )}
    </>
  );
}
