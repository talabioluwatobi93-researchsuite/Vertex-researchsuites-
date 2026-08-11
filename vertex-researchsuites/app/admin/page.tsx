"use client";

import { useEffect, useState } from "react";
import ApiCredits from '../../components/ApiCredits';
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

type ActiveUser = {
  user_id: string;
  email: string;
  last_seen: string;
};

type FeatureUsage = {
  label: string;
  count: number;
  totalAmount: number;
};

type AdminUserRow = {
  user_id: string;
  email: string;
  created_at: string;
  balance: number;
};

type UserDetailEvent = {
  id: string;
  type: "topup" | "purchase";
  label: string;
  amount: number;
  status: string;
  created_at: string;
};

const ACTIVE_WINDOW_MS = 3 * 60 * 1000;

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
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [activeUsersError, setActiveUsersError] = useState<string | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [featureUsageError, setFeatureUsageError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEvents, setSelectedUserEvents] = useState<UserDetailEvent[]>([]);
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  const [selectedUserError, setSelectedUserError] = useState<string | null>(null);

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
      await Promise.all([loadStats(), loadActivity(), loadActiveUsers(), loadFeatureUsage(), loadUsers()]);
    }

    async function loadUsers() {
      const [dirRes, walletsRes] = await Promise.all([
        supabase
          .from("admin_user_directory")
          .select("user_id, email, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("wallets").select("id, balance"),
      ]);

      if (!active) return;

      const err = dirRes.error || walletsRes.error;
      if (err) {
        setUsersError(err.message);
        return;
      }

      const balanceMap = new Map<string, number>();
      (walletsRes.data || []).forEach((w: any) => balanceMap.set(w.id, Number(w.balance || 0)));

      const rows: AdminUserRow[] = (dirRes.data || []).map((u: any) => ({
        user_id: u.user_id,
        email: u.email,
        created_at: u.created_at,
        balance: balanceMap.get(u.user_id) || 0,
      }));

      setUsers(rows);
    }

    async function loadFeatureUsage() {
      const { data, error } = await supabase
        .from("transactions")
        .select("description, amount")
        .eq("status", "success");

      if (!active) return;

      if (error) {
        setFeatureUsageError(error.message);
        return;
      }

      const grouped = new Map<string, { count: number; totalAmount: number }>();
      (data || []).forEach((t: any) => {
        const label = t.description || "Unlabeled feature";
        const existing = grouped.get(label) || { count: 0, totalAmount: 0 };
        existing.count += 1;
        existing.totalAmount += Number(t.amount || 0);
        grouped.set(label, existing);
      });

      const usage: FeatureUsage[] = Array.from(grouped.entries())
        .map(([label, v]) => ({ label, count: v.count, totalAmount: v.totalAmount }))
        .sort((a, b) => b.count - a.count);

      setFeatureUsage(usage);
    }

    async function loadActiveUsers() {
      const sinceIso = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();

      const [presenceRes, dirRes] = await Promise.all([
        supabase
          .from("user_presence")
          .select("user_id, last_seen")
          .gte("last_seen", sinceIso)
          .order("last_seen", { ascending: false }),
        supabase.from("admin_user_directory").select("user_id, email"),
      ]);

      if (!active) return;

      const err = presenceRes.error || dirRes.error;
      if (err) {
        setActiveUsersError(err.message);
        return;
      }

      const emailMap = new Map<string, string>();
      (dirRes.data || []).forEach((u: any) => emailMap.set(u.user_id, u.email));

      const users: ActiveUser[] = (presenceRes.data || []).map((p: any) => ({
        user_id: p.user_id,
        email: emailMap.get(p.user_id) || "Unknown user",
        last_seen: p.last_seen,
      }));

      setActiveUsers(users);
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

    const refreshInterval = setInterval(() => {
      if (active) loadActiveUsers();
    }, 30000);

    return () => {
      active = false;
      clearInterval(refreshInterval);
    };
  }, []);

  async function selectUser(userId: string) {
    if (selectedUserId === userId) {
      setSelectedUserId(null);
      setSelectedUserEvents([]);
      return;
    }

    setSelectedUserId(userId);
    setSelectedUserLoading(true);
    setSelectedUserError(null);

    const [txRes, wtRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, description, amount, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("wallet_transactions")
        .select("id, amount, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const err = txRes.error || wtRes.error;
    if (err) {
      setSelectedUserError(err.message);
      setSelectedUserLoading(false);
      return;
    }

    const events: UserDetailEvent[] = [];

    (txRes.data || []).forEach((t: any) => {
      events.push({
        id: `tx-${t.id}`,
        type: "purchase",
        label: t.description || "Feature purchase",
        amount: t.amount,
        status: t.status,
        created_at: t.created_at,
      });
    });

    (wtRes.data || []).forEach((w: any) => {
      events.push({
        id: `wt-${w.id}`,
        type: "topup",
        label: "Wallet top-up",
        amount: w.amount,
        status: w.status,
        created_at: w.created_at,
      });
    });

    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setSelectedUserEvents(events);
    setSelectedUserLoading(false);
  }

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      <div
        style={{
          marginTop: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          borderRadius: 999,
          padding: "8px 14px",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: activeUsers.length > 0 ? "#3CB371" : MUTED,
            display: "inline-block",
          }}
        />
        <span style={{ color: DARK, fontSize: 13, fontWeight: 600 }}>
          {activeUsers.length} active now
        </span>
      </div>

      {activeUsersError && <ErrorBox message={`Couldn't load active users: ${activeUsersError}`} />}

      {activeUsers.length > 0 && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {activeUsers.map((u) => (
            <div
              key={u.user_id}
              style={{
                background: "#FFFFFF",
                border: `1px solid ${BORDER}`,
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                color: DARK,
              }}
            >
              {u.email}
            </div>
          ))}
        </div>
      )}

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
        Feature Usage
      </h2>

      {featureUsageError && <ErrorBox message={`Couldn't load feature usage: ${featureUsageError}`} />}

      {!featureUsageError && featureUsage.length === 0 && (
        <div style={{ color: MUTED, fontSize: 14 }}>No feature purchases yet.</div>
      )}

      {featureUsage.length > 0 && (
        <div
          style={{
            background: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {featureUsage.map((f, i) => {
            const maxCount = featureUsage[0].count || 1;
            const widthPct = Math.max(6, Math.round((f.count / maxCount) * 100));
            return (
              <div
                key={f.label}
                style={{
                  padding: "12px 16px",
                  borderBottom: i === featureUsage.length - 1 ? "none" : `1px solid ${BORDER}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: DARK, fontSize: 13, fontWeight: 600 }}>{f.label}</span>
                  <span style={{ color: MUTED, fontSize: 12 }}>
                    {f.count} use{f.count === 1 ? "" : "s"} · {formatNaira(f.totalAmount)}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "#F1E7C8",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${widthPct}%`,
                      borderRadius: 999,
                      background: GOLD,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ color: DARK, fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>
      <h2 style={{ color: DARK, fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>
        API Credits
      </h2>

      <ApiCredits />

        User Lookup
      </h2>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by email…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 14px",
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          fontSize: 14,
          color: DARK,
          background: "#FFFFFF",
          marginBottom: 12,
        }}
      />

      {usersError && <ErrorBox message={`Couldn't load users: ${usersError}`} />}

      {!usersError && filteredUsers.length === 0 && (
        <div style={{ color: MUTED, fontSize: 14 }}>No users found.</div>
      )}

      {filteredUsers.length > 0 && (
        <div
          style={{
            background: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {filteredUsers.map((u, i) => (
            <div key={u.user_id}>
              <div
                onClick={() => selectUser(u.user_id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom:
                    i === filteredUsers.length - 1 && selectedUserId !== u.user_id
                      ? "none"
                      : `1px solid ${BORDER}`,
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ color: DARK, fontSize: 13, fontWeight: 600 }}>{u.email}</div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                    Joined {timeAgo(u.created_at)}
                  </div>
                </div>
                <div style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>
                  {formatNaira(u.balance)}
                </div>
              </div>

              {selectedUserId === u.user_id && (
                <div
                  style={{
                    padding: "12px 16px 16px",
                    background: BG,
                    borderBottom: i === filteredUsers.length - 1 ? "none" : `1px solid ${BORDER}`,
                  }}
                >
                  {selectedUserLoading && (
                    <div style={{ color: MUTED, fontSize: 13 }}>Loading activity…</div>
                  )}
                  {selectedUserError && (
                    <div style={{ color: "#A33", fontSize: 13 }}>
                      Couldn't load activity: {selectedUserError}
                    </div>
                  )}
                  {!selectedUserLoading && !selectedUserError && selectedUserEvents.length === 0 && (
                    <div style={{ color: MUTED, fontSize: 13 }}>No activity for this user yet.</div>
                  )}
                  {selectedUserEvents.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: DARK }}>
                        {iconFor(ev.type === "topup" ? "topup" : "purchase")} {ev.label} · {timeAgo(ev.created_at)}
                      </span>
                      <span style={{ color: GOLD, fontWeight: 600 }}>{formatNaira(ev.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
