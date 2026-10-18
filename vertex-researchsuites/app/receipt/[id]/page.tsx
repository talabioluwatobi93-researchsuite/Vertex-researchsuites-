"use client";

import { useEffect, useRef, useState } from "react";
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
const BLACK = "#111111";

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
  const [name, setName] = useState("");
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const sheetRef = useRef<HTMLDivElement>(null);
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
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setName((prof && prof.full_name) || "");
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
  const feature = row.description || "Feature purchase";

  const line = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid " + BORDER, fontSize: 14 }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color: DARK, fontWeight: 600, textAlign: "right", wordBreak: "break-all", marginLeft: 12 }}>{value}</span>
    </div>
  );

  const downloadReceipt = () => {
    const el = sheetRef.current;
    if (!el) return;
    const html =
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>Receipt " + String(number || "") + "</title></head>" +
      '<body style="margin:0;background:#F9F9F9;font-family:Arial,sans-serif;padding:20px">' +
      '<div style="max-width:520px;margin:0 auto">' + el.outerHTML + "</div></body></html>";
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Vertex-Receipt-" + String(number || row.id) + ".html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 520, margin: "20px auto 0" }}>
        <div ref={sheetRef} style={{ background: "#FFFFFF", border: "1px solid " + BORDER, borderRadius: 14, overflow: "hidden", fontFamily: "Arial, sans-serif" }}>
          <div style={{ background: BLACK, padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: GOLD, fontSize: 24, fontWeight: 800 }}>Vertex</div>
              <div style={{ color: GOLD, fontSize: 15, fontWeight: 600 }}>Researchsuite</div>
              <div style={{ color: "#BBBBBB", fontSize: 11, marginTop: 6 }}>Smarter Research. Better Decisions.</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>RECEIPT</div>
              {number ? <div style={{ color: GOLD, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{number}</div> : null}
              <div style={{ color: "#BBBBBB", fontSize: 12, marginTop: 4 }}>{receiptDate(row.created_at)}</div>
              {paid ? (
                <div style={{ display: "inline-block", marginTop: 8, padding: "3px 12px", borderRadius: 12, background: "#E6F4EA", color: "#1E7B34", fontSize: 12, fontWeight: 700 }}>
                  Paid
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ padding: 22 }}>
            {name ? <div style={{ color: DARK, fontSize: 17, fontWeight: 700 }}>Hello, {name}</div> : null}
            <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>
              Thank you for choosing Vertex Researchsuite.
              {paid ? " Your payment has been received and your feature is now active." : ""}
            </div>

            <div style={{ marginTop: 18, background: BLACK, borderRadius: 12, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: GOLD, fontSize: 11, letterSpacing: 1 }}>FEATURE PURCHASED</div>
                <div style={{ color: "#FFFFFF", fontSize: 17, fontWeight: 700, marginTop: 4 }}>{feature}</div>
              </div>
              <div style={{ textAlign: "right", marginLeft: 12 }}>
                <div style={{ color: "#BBBBBB", fontSize: 11 }}>Total</div>
                <div style={{ color: GOLD, fontSize: 20, fontWeight: 800 }}>{naira(row.amount)}</div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ color: DARK, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Transaction Details</div>
              {line("Transaction ID", row.id)}
              {line("Feature", feature)}
              {paid ? line("Payment method", "Wallet balance") : null}
              {line("Total amount", naira(row.amount))}
              {line("Date & time", receiptDate(row.created_at))}
            </div>

            {paid ? (
              <div style={{ marginTop: 16, background: "#E6F4EA", borderRadius: 10, padding: 12, color: "#1E7B34", fontSize: 13, fontWeight: 600 }}>
                Payment successful. The amount has been deducted from your Vertex wallet.
              </div>
            ) : null}

            {support ? (
              <p style={{ color: MUTED, fontSize: 12, marginTop: 16 }}>Need help? {support}</p>
            ) : null}
          </div>

          <div style={{ background: BLACK, padding: "12px 22px", color: GOLD, fontSize: 12, textAlign: "center" }}>
            Vertex Researchsuite
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={downloadReceipt}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: GOLD, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}
          >
            Download
          </button>
          <button
            onClick={() => window.print()}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid " + GOLD, background: "#FFFFFF", color: DARK, fontWeight: 700, cursor: "pointer" }}
          >
            Print
          </button>
        </div>
        <div className="no-print" style={{ marginTop: 10 }}>
          <Link href="/purchases" style={{ display: "block", textAlign: "center", padding: "10px 0", borderRadius: 10, border: "1px solid " + BORDER, color: DARK, textDecoration: "none" }}>
            Purchase History
          </Link>
        </div>
      </div>
      <style>{"@media print { .no-print { display: none !important; } }"}</style>
    </div>
  );
}
