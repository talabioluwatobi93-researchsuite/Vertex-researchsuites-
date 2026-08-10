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
const BORDER = "#EEEEEE";

type AccessStatus = "loading" | "denied" | "granted";

type RevenueStats = {
  totalFeatureRevenue: number;
  totalTopUps: number;
  todayRevenue: number;
  monthRevenue: number;
  walletLiability: number;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminPage() {
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAdminThenLoad() {
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
        return;
      }

      setStatus("granted");
      await loadStats();
    }

    async function loadStats() {
      const todayIso = startOfToday().toISOString();
      const monthIso = startOfMonth().toISOString();

      const [
        featureTxRes,
        topUpsRes,
        todayFeatureRes,
        todayTopUpsRes,
        monthFeatureRes,
        monthTopUpsRes,
        walletsRes,
      ] = await Promise.all([
        supabase.from("transactions").select("amount").eq("status", "success"),
        supabase.from("wallet_transactions").select("amount").eq("status", "success"),
        supabase.from("transactions").select("amount").eq("status", "success").gte("created_at", todayIso),
        supabase.from("wallet_transactions").select("amount").eq("status", "success").gte("created_at", todayIso),
        supabase.from("transactions").select("amount").eq("status", "success").gte("created_at", monthIso),
        supabase.from("wallet_transactions").select("amount").eq("status", "success").gte("created_at", monthIso),
        supabase.from("wallets").select("balance"),
      ]);

      if (!active) return;

      const firstError =
        featureTxRes.error ||
        topUpsRes.error ||
        todayFeatureRes.error ||
        todayTopUpsRes.error ||
        monthFeatureRes.error ||
        monthTopUpsRes.error ||
        walletsRes.error;

      if (firstError) {
        setStatsError(firstError.message);
        return;
      }

      const sum = (rows: { amount: number }[] | null) =>
        (rows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

      const sumBalance = (rows: { balance: number }[] | null) =>
        (rows || []).reduce((acc, r) => acc + Number(r.balance || 0), 0);

      setStats({
        totalFeatureRevenue: sum(featureTxRes.data as any),
        totalTopUps: sum(topUpsRes.data as any),
        todayRevenue: sum(todayFeatureRes.data as any) + sum(todayTopUpsRes.data as any),
        monthRevenue: sum(monthFeatureRes.data as any) + sum(monthTopUpsRes.data as any),
        walletLiability: sumBalance(walletsRes.data as any),
      });
    }

    checkAdminThenLoad();

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
        Revenue snapshot below. More sections coming next.
      </p>

      {statsError && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            background: "#FFF4F4",
            border: "1px solid #E5B4B4",
            color: "#A33",
            fontSize: 13,
          }}
        >
          Couldn't load revenue data: {statsError}
        </div>
      )}

      {!statsError && !stats && (
        <div style={{ marginTop: 20, color: MUTED, fontSize: 14 }}>Loading revenue…</div>
      )}

      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginTop: 20,
          }}
        >
          <StatCard label="Today's Revenue" value={formatNaira(stats.todayRevenue)} highlight />
          <StatCard label="This Month" value={formatNaira(stats.monthRevenue)} />
          <StatCard label="Total Feature Revenue" value={formatNaira(stats.totalFeatureRevenue)} />
          <StatCard label="Total Top-Ups" value={formatNaira(stats.totalTopUps)} />
          <StatCard label="Wallet Liability (all balances)" value={formatNaira(stats.walletLiability)} />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: highlight
          ? "linear-gradient(135deg, #F5D485 0%, #D4AF37 45%, #9C7A16 100%)"
          : "#FFFFFF",
        border: highlight ? "none" : `1px solid ${BORDER}`,
        boxShadow: highlight ? "0 4px 14px rgba(184,134,11,0.25)" : "none",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.5px",
          color: highlight ? "#3d3110" : MUTED,
          marginBottom: 6,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: highlight ? DARK : DARK,
        }}
      >
        {value}
      </div>
    </div>
  );
}
