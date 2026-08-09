"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function TopUpButton() {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleTopUp = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        alert("Could not get user info. Please refresh and try again.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/wallet/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount, userId: user.id, email: user.email }),
      });
      const data = await res.json();

      if (!data.access_code) {
        alert(data.error || "Could not start payment");
        setLoading(false);
        return;
      }

      const { default: PaystackPop } = await import("@paystack/inline-js");
      const popup = new PaystackPop();
      popup.resumeTransaction(data.access_code, {
        onSuccess: async (transaction: { reference: string }) => {
          await fetch("/api/wallet/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: transaction.reference, userId: user.id }),
          });
          setLoading(false);
          setOpen(false);
          setAmount("");
        },
        onCancel: () => {
          setLoading(false);
        },
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          backgroundColor: "#333333",
          color: "#D4AF37",
          border: "none",
          borderRadius: "10px",
          padding: "10px 18px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Top Up
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#F9F9F9",
              padding: 24,
              borderRadius: 8,
              width: 320,
              border: "1px solid #EEEEEE",
            }}
          >
            <h3 style={{ color: "#333333", marginBottom: 12 }}>Top Up Wallet</h3>
            <input
              type="number"
              placeholder="Enter amount (₦)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #EEEEEE",
                marginBottom: 12,
                color: "#333333",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #EEEEEE",
                  background: "#fff",
                  color: "#777777",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: "none",
                  background: "#D4AF37",
                  color: "#333333",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {loading ? "Processing..." : "Pay Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
