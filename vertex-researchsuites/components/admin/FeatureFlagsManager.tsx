"use client";
import { useEffect, useState } from "react";

type Flag = { key: string; label: string; enabled: boolean };

export default function FeatureFlagsManager({ supabase }: { supabase: any }) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, label, enabled")
        .order("label", { ascending: true });
      if (!active) return;
      if (error) { setError(error.message); setLoading(false); return; }
      setFlags(data || []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [supabase]);

  async function toggle(key: string, current: boolean) {
    setSavingKey(key);
    const { error } = await supabase
      .from("feature_flags")
      .update({ enabled: !current, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (!error) {
      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !current } : f)));
    } else {
      setError(error.message);
    }
    setSavingKey(null);
  }

  if (loading) return <div style={{ color: "#777777", fontSize: 14 }}>Loading flags...</div>;
  if (error) return <div style={{ color: "#A33", fontSize: 13 }}>Couldn't load flags: {error}</div>;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #EEEEEE", borderRadius: 14, overflow: "hidden" }}>
      {flags.map((f, i) => (
        <div
          key={f.key}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: i === flags.length - 1 ? "none" : "1px solid #EEEEEE",
          }}
        >
          <div>
            <div style={{ color: "#333333", fontSize: 13, fontWeight: 600 }}>{f.label}</div>
            <div style={{ color: "#777777", fontSize: 12 }}>{f.key}</div>
          </div>
          <button
            onClick={() => toggle(f.key, f.enabled)}
            disabled={savingKey === f.key}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              color: "#FFFFFF",
              background: f.enabled ? "#3CB371" : "#A33",
              opacity: savingKey === f.key ? 0.6 : 1,
            }}
          >
            {savingKey === f.key ? "..." : f.enabled ? "ON" : "OFF"}
          </button>
        </div>
      ))}
    </div>
  );
}
