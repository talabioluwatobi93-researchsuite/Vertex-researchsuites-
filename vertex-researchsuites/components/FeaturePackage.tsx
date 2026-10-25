"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from '@/lib/supabase';


const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#777777";
const BORDER = "#EEEEEE";

type Props = {
  chargeFeature?: string;
  chargeDescription?: string;
  title: string;
  intro?: string;
  items: string[];
  featureKey: string;
  nextHref: string;
  rates?: { label: string; key: string }[];
};

export default function FeaturePackage({ title, intro, items, featureKey, nextHref, chargeFeature, chargeDescription, rates }: Props) {
  const [paying, setPaying] = useState(false);
  const router = useRouter();
  const [price, setPrice] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [rateRows, setRateRows] = useState<{ label: string; price: number }[] | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        const { data: p, error: pe } = await supabase
          .from("feature_pricing")
          .select("price")
          .eq("feature_name", featureKey)
          .maybeSingle();
        if (pe) throw pe;
        if (rates && rates.length) {
          const { data: rr, error: re } = await supabase.from("feature_pricing").select("feature_name, price").in("feature_name", rates.map((r) => r.key));
          if (re) throw re;
          const rows = rates.map((r) => { const f: any = (rr || []).find((x: any) => x.feature_name === r.key); return f ? { label: r.label, price: Number(f.price) } : null; });
          if (rows.some((x) => !x)) throw new Error("rates");
          if (active) setRateRows(rows as { label: string; price: number }[]);
        }
        const { data: w } = await supabase.from("wallets").select("balance").eq("id", user.id).maybeSingle();
        if (!active) return;
        setPrice(Number(p?.price ?? 0));
        setBalance(Number(w?.balance ?? 0));
      } catch {
        if (active) setError("Could not load pricing. Please refresh.");
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [featureKey, router]);

  async function accept() {
    if (!chargeFeature || !price || price <= 0) {
      router.push(nextHref);
      return;
    }
    if (paying) return;
    setPaying(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("start_paid_job", {
        p_feature: chargeFeature,
        p_description: chargeDescription || title,
      });
      const d: any = data;
      const msg = String((rpcError && rpcError.message) || (d && d.error) || "");
      if (rpcError || !d || d.ok === false) {
        setError(msg.indexOf("insufficient") !== -1 ? "Your balance is not enough. Please top up." : "Could not process payment. Please try again.");
        setPaying(false);
        return;
      }
      const jid = d.job_id;
      router.replace(jid ? nextHref + "?job=" + encodeURIComponent(String(jid)) : nextHref);
    } catch {
      setError("Something went wrong. Please try again.");
      setPaying(false);
    }
  }

  const ready = price !== null && balance !== null && (!rates || rateRows !== null);
  const enough = ready && (price === 0 || (balance as number) >= (price as number));

  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 520, margin: "40px auto 0" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid " + BORDER, borderRadius: 14, padding: 22 }}>
          <h1 style={{ color: DARK, fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h1>
          {intro ? <p style={{ color: MUTED, fontSize: 14, marginTop: 8 }}>{intro}</p> : null}

          <div style={{ color: DARK, fontSize: 15, fontWeight: 600, marginTop: 18 }}>What you get</div>
          <ul style={{ color: DARK, fontSize: 14, paddingLeft: 18, marginTop: 8, lineHeight: 1.6 }}>
            {items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>

          <div style={{ borderTop: "1px solid " + BORDER, marginTop: 16, paddingTop: 14 }}>
            <div style={{ color: MUTED, fontSize: 13 }}>Price</div>
            <div style={{ color: DARK, fontSize: 26, fontWeight: 700 }}>
              {!ready ? "Loading..." : rateRows ? <>{rateRows.map((r, i) => <div key={i} style={{ fontSize: 16 }}>{r.label}: {"\u20A6"}{r.price.toLocaleString()} per minute</div>)}</> : price === 0 ? "Free" : <>{"\u20A6"}{(price as number).toLocaleString()}</>}
            </div>
            {ready && (price as number) > 0 ? (
              <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>
                Your balance: {"\u20A6"}{(balance as number).toLocaleString()}
              </div>
            ) : null}
          </div>

          {error ? <p style={{ color: "#C0392B", fontSize: 14, marginTop: 12 }}>{error}</p> : null}

          {ready && !enough ? (
            <p style={{ color: "#C0392B", fontSize: 14, marginTop: 12 }}>
              Your balance is not enough. <Link href="/dashboard" style={{ color: DARK, fontWeight: 600 }}>Go to dashboard to top up</Link>
            </p>
          ) : null}

          <button
            onClick={accept}
            disabled={!ready || !enough || paying}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              background: !ready || !enough ? "#CCCCCC" : GOLD,
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 700,
              cursor: !ready || !enough ? "not-allowed" : "pointer",
            }}
          >
            {paying ? "Please wait..." : "Accept and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
