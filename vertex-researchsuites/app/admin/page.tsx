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
  weekRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  walletLiability: number;
};

type ActivityEvent = {
  id: string;
  type: "topup" | "purchase" | "signup";
  label: string;
  amount?: number;
  email: string;
  created_at: string;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = startOfToday();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfYear() {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminPage() {
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

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
      await Promise.all([loadStats(), loadActivity()]);
    }

    async function loadStats() {
      const todayIso = startOfToday().toISOString();
      const weekIso = startOfWeek().toISOString();
      const monthIso = startOfMonth().toISOString();
      const yearIso = startOfYear().toISOString();

      const bucket = (table: string, sinceIso?: string) => {
        let q = supabase.from(table).select("amount").eq("status", "success");
        if (sinceIso) q = q.gte("created_at", sinceIso);
        return q;
      };

      const [
        featureTotal,
        topUpsTotal,
        featureToday,
        topUpsToday,
        featureWeek,
        topUpsWeek,
        featureMonth,
        topUpsMonth,
        featureYear,
        topUpsYear,
        walletsRes,
      ] = await Promise.all([
        bucket("transactions"),
        bucket("wallet_transactions"),
        bucket("transactions", todayIso),
        bucket("wallet_transactions", todayIso),
        bucket("transactions", weekIso),
        bucket("wallet_transactions", weekIso),
        bucket("transactions", monthIso),
        bucket("wallet_transactions", monthIso),
        bucket("transactions", yearIso),
        bucket("wallet_transactions", yearIso),
        supabase.from("wallets").select("balance"),
      ]);

      if (!active) return;

      const results = [
        featureTotal,
        topUpsTotal,
        featureToday,
        topUpsToday,
        featureWeek,
        topUpsWeek,
        featureMonth,
        topUpsMonth,
        featureYear,
        topUpsYear,
        walletsRes,
      ];
      const firstError = results.find((r) => r.error)?.error;

      if (firstError) {
        setStatsError(firstError.message);
        return;
      }

      const sum = (rows: { amount: number }[] | null) =>
        (rows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
      const sumBalance = (rows: { balance: number }[] | null) =>
        (rows || []).reduce((acc, r) => acc + Number(r.balance || 0), 0);

      setStats({
        totalFeatureRevenue: sum(featureTotal.data as any),
        totalTopUps: sum(topUpsTotal.data as any),
        todayRevenue: sum(featureToday.data as any) + sum(topUpsToday.data as any),
        weekRevenue: sum(featureWeek.data as any) + sum(topUpsWeek.data as any),
        monthRevenue: sum(featureMonth.data as any) + sum(topUpsMonth.data as any),
        yearRevenue: sum(featureYear.data as any) + sum(topUpsYear.data as any),
        walletLiability: sumBalance(walletsRes.data as any),
      });
    }

    async function loadActivity() {
      const [txRes, wtRes, dirRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, user_id, description, amount, status, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("wallet_transactions")
          .select("id, user_id, amount, status, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("admin_user_directory")
          .select("user_id, email, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (!active) return;

      const err = txRes.error || wtRes.error || dirRes.error;
      if (err) {
        setActivityError(err.message);
        return;
      }

      const emailMap = new Map<string, string>();
      (dirRes.data || []).forEach((u: any) => emailMap.set(u.user_id, u.email));

      const events: ActivityEvent[] = [];

      (txRes.data || []).forEach((t: any) => {
        events.push({
          id: `tx-${t.id}`,
          type: "purchase",
          label: t.description || "Feature purchase",
          amount: t.amount,
          email: emailMap.get(t.user_id) || "Unknown user",
          created_at: t.created_at,
        });
      });

      (wtRes.data || []).forEach((w: any) => {
        events.push({
          id: `wt-${w.id}`,
          type: "topup",
          label: "Wallet top-up",
          amount: w.amount,
          email: emailMap.get(w.user_id) || "Unknown user",
          created_at: w.created_at,
        });
      });

      (dirRes.data || []).forEach((u: any) => {
        events.push({
          id: `signup-${u.user_id}`,
          type: "signup",
          label: "New signup",
          email: u.email,
          created_at: u.created_at,
        });
      });

      events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivity(events.slice(0, 15));
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
        Revenue snapshot and live activity below.
      </p>

      {statsError && (
        <ErrorBox message={`Couldn't load revenue data: ${statsError}`} />
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
          <StatCard label="This Week" value={formatNaira(stats.weekRevenue)} />
          <StatCard label="This Month" value={formatNaira(stats.monthRevenue)} />
          <StatCard label="This Year" value={formatNaira(stats.yearRevenue)} />
          <StatCard label="Total Feature Revenue" value={formatNaira(stats.totalFeatureRevenue)} />
          <StatCard label="Total Top-Ups" value={formatNaira(stats.totalTopUps)} />
          <StatCard label="Wallet Liability (all balances)" value={formatNaira(stats.walletLiability)} />
        </div>
      )}

      <h2 style={{ color: DARK, fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>
        Recent Activity
      </h2>

      {activityError && <ErrorBox message={`Couldn't load activity: ${activityError}`} />}

      {!activityError && activity.length === 0 && (
        <div style={{ color: MUTED, fontSize: 14 }}>No activity yet.</div>
      )}

      {activity.length > 0 && (
        <div
          style={{
            background: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {activity.map((ev, i) => (
            <div
              key={ev.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: i === activity.length - 1 ? "none" : `1px solid ${BORDER}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{iconFor(ev.type)}</span>
                <div>
                  <div style={{ color: DARK, fontSize: 13, fontWeight: 600 }}>
                    {ev.label}
                  </div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                    {ev.email} · {timeAgo(ev.created_at)}
                  </div>
                </div>
              </div>
              {ev.amount !== undefined && (
                <div style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>
                  {formatNaira(ev.amount)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function iconFor(type: ActivityEvent["type"]) {
  if (type === "topup") return "💰";
  if (type === "purchase") return "🛒";
  return "🆕";
}

function ErrorBox({ message }: { message: string }) {
  return (
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
      {message}
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
      <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{value}</div>
    </div>
  );
}
