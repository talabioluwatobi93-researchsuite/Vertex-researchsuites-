"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#777777";
const BORDER = "#EEEEEE";

type CreditRow = {
  id: string;
  provider: string;
  balance: number;
  low_threshold: number;
  updated_at: string;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ApiCredits() {
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { balance: string; threshold: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_credit_balances")
      .select("id, provider, balance, low_threshold, updated_at")
      .order("provider", { ascending: true });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as CreditRow[];
    setRows(rows);

    const d: Record<string, { balance: string; threshold: string }> = {};
    rows.forEach((r) => {
      d[r.id] = { balance: String(r.balance), threshold: String(r.low_threshold) };
    });
    setDrafts(d);
    setLoading(false);
  }

  async function save(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    setSavingId(id);
    const { error } = await supabase
      .from("api_credit_balances")
      .update({
        balance: Number(draft.balance) || 0,
        low_threshold: Number(draft.threshold) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    setSavingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    await load();
  }

  if (loading) {
    return <div style={{ color: MUTED, fontSize: 14 }}>Loading API credits…</div>;
  }

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: "#FFF4F4",
          border: "1px solid #E5B4B4",
          color: "#A33",
          fontSize: 13,
        }}
      >
        Couldn't load API credits: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {rows.map((r, i) => {
        const draft = drafts[r.id] || { balance: "0", threshold: "0" };
        const isLow = Number(draft.balance) <= Number(draft.threshold);
        return (
          <div
            key={r.id}
            style={{
              padding: 16,
              borderBottom: i === rows.length - 1 ? "none" : `1px solid ${BORDER}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: isLow ? "#D9534F" : "#3CB371",
                    display: "inline-block",
                  }}
                />
                <span style={{ color: DARK, fontSize: 14, fontWeight: 700 }}>{r.provider}</span>
              </div>
              <span style={{ color: MUTED, fontSize: 11 }}>
                Updated {formatWhen(r.updated_at)}
              </span>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ color: MUTED, fontSize: 11, display: "block", marginBottom: 4 }}>
                  Balance
                </label>
                <input
                  type="number"
                  value={draft.balance}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [r.id]: { ...draft, balance: e.target.value } })
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    fontSize: 13,
                    color: DARK,
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ color: MUTED, fontSize: 11, display: "block", marginBottom: 4 }}>
                  Low threshold
                </label>
                <input
                  type="number"
                  value={draft.threshold}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [r.id]: { ...draft, threshold: e.target.value } })
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    fontSize: 13,
                    color: DARK,
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={() => save(r.id)}
                  disabled={savingId === r.id}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: GOLD,
                    color: "#3d3110",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {savingId === r.id ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
