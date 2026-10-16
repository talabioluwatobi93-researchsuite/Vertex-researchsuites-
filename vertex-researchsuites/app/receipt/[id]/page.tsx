"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { receiptNumber, receiptDate, naira } from "@/lib/receipt";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#777777";
const BORDER = "#EEEEEE";

type Row = {
  id: string;
  type: string | null;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  receipt_seq: number | null;
};

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const [row, setRow] = useState<Row | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

  useEffect(() => {
    let active = true;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, amount, status, description, created_at, receipt_seq")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        setState("missing");
        return;
      }
      setEmail(user.email || "");
      setRow(data as Row);
      setState("ok");
    }
    load();
    return () => {
      active = false;
    };
  }, [id, router]);

  if (state === "loading") {
    return <div style={{ padding: 24, color: MUTED }}>Loading...</div>;
  }
  if (state === "missing" || !row) {
    return (
      <div style={{ padding: 24, maxWidth: 520, margin: "40px auto" }}>
        <p style={{ color: DARK, fontSize: 16 }}>Receipt not found</p>
        <Link href="/purchases" style={{ color: MUTED, fontSize: 14 }}>Back to Purchase History</Link>
      </div>
    );
  }

  const paid = row.type === "debit" && String(row.status).toLowerCase() === "success";
  const number = receiptNumber(row.receipt_seq, row.created_at);
  const line = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + BORDER, fontSize: 14 }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color: DARK, fontWeight: 600, textAlign: "right", wordBreak: "break-all", marginLeft: 12 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 520, margin: "40px auto 0" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid " + BORDER, borderRadius: 14, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: GOLD, fontSize: 18, fontWeight: 800 }}>Vertex Research Suite</div>
            <div style={{ color: DARK, fontSize: 18, fontWeight: 700 }}>RECEIPT</div>
          </div>
          <div style={{ marginTop: 10, color: MUTED, fontSize: 13 }}>
            {number ? <>Receipt No: <b style={{ color: DARK }}>{number}</b><br /></> : null}
            {receiptDate(row.created_at)}
          </div>
          {paid ? (
            <div style={{ display: "inline-block", marginTop: 12, padding: "4px 10px", borderRadius: 8, background: "#FBF3D5", color: DARK, fontSize: 12, fontWeight: 700 }}>
              Paid from wallet balance
            </div>
          ) : null}

          <div style={{ marginTop: 18, border: "1px solid " + BORDER, borderRadius: 10, padding: 14 }}>
            <div style={{ color: MUTED, fontSize: 12 }}>Feature</div>
            <div style={{ color: DARK, fontSize: 16, fontWeight: 700 }}>{row.description || "Feature purchase"}</div>
          </div>

          <div style={{ marginTop: 14 }}>
            {line("Purchase ID", row.id)}
            {line("Payment method", "Wallet balance")}
            {line("Date", receiptDate(row.created_at))}
            {email ? line("Email", email) : null}
          </div>

          {paid ? <p style={{ color: MUTED, fontSize: 13, marginTop: 12 }}>Feature activated on your account.</p> : null}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 16 }}>
            <span style={{ color: DARK, fontWeight: 600 }}>Total</span>
            <span style={{ color: DARK, fontWeight: 800 }}>{naira(row.amount)}</span>
          </div>

          {support ? <p style={{ color: MUTED, fontSize: 12, marginTop: 16 }}>Need help? {support}</p> : null}
        </div>

        <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={() => window.print()}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: GOLD, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}
          >
            Print / Save as PDF
          </button>
          <Link href="/purchases" style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, border: "1px solid " + BORDER, color: DARK, textDecoration: "none", background: "#FFFFFF" }}>
            Purchase History
          </Link>
        </div>
      </div>
      <style>{"@media print { .no-print { display: none !important; } }"}</style>
    </div>
  );
}
