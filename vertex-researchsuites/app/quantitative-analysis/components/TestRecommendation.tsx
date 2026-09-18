'use client';

import { useState, useEffect } from 'react';

interface RecommendationResult {
  appRecommendation: { test: string; reason: string };
  userPlan: {
    suggestedTest: string;
    suggestedTests?: { suggestedTest: string; eligible: boolean; eligibilityNote: string }[];
    involvedConstructs: string[];
    reasoning: string;
    eligible: boolean;
    eligibilityNote: string;
  } | null;
  profile: any;
}

export default function TestRecommendation({
  sessionId,
  onSelect,
  onManual,
}: {
  sessionId: string;
  onSelect: (test: string) => void;
  onManual: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (fetched || !sessionId) return;
    setFetched(true);
    setLoading(true);
    setError(null);

    fetch('/api/quantitative-analysis/recommend-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setResult(data);
      })
      .catch((e: any) => setError(e.message || 'Failed to get recommendation'))
      .finally(() => setLoading(false));
  }, [sessionId, fetched]);

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Which test should you run?</h3>

      {loading && <p style={{ fontSize: 13, color: '#777' }}>Analyzing your data and research plan...</p>}
      {error && <p style={{ color: '#b00020', fontSize: 13 }}>{error}</p>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 12 }}>
            <strong style={{ fontSize: 13 }}>App's Recommendation: {result.appRecommendation.test}</strong>
            <p style={{ fontSize: 13, color: '#444', margin: '6px 0' }}>{result.appRecommendation.reason}</p>
            <button onClick={() => onSelect(result.appRecommendation.test)}>Use this test</button>
          </div>

          {result.userPlan && (
        <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 12 }}>
          <strong style={{ fontSize: 13 }}>Based on Your Stated Plan</strong>
          <p style={{ fontSize: 13, color: '#444', margin: '6px 0' }}>{result.userPlan.reasoning}</p>
          {(result.userPlan.suggestedTests && result.userPlan.suggestedTests.length > 0
            ? result.userPlan.suggestedTests
            : [{ suggestedTest: result.userPlan.suggestedTest, eligible: result.userPlan.eligible, eligibilityNote: result.userPlan.eligibilityNote }]
          ).map((plan, idx) => (
            <div key={idx} style={{ marginTop: 8, paddingTop: idx > 0 ? 8 : 0, borderTop: idx > 0 ? '1px solid #eee' : 'none' }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{plan.suggestedTest}</p>
              <p style={{ fontSize: 12, color: plan.eligible ? '#0a7d2f' : '#b00020', margin: '4px 0' }}>
                {plan.eligibilityNote}
              </p>
              {plan.eligible && (
                <button onClick={() => onSelect(plan.suggestedTest)}>Use this test</button>
              )}
            </div>
          ))}
        </div>
      )}

          {!result.userPlan && (
            <p style={{ fontSize: 12, color: '#777' }}>
              No research questions/hypotheses were provided at upload, so only the data-driven recommendation is shown above.
            </p>
          )}
        </div>
      )}

      <button
        onClick={onManual}
        style={{ marginTop: 12, background: 'none', border: 'none', color: '#0645AD', cursor: 'pointer', padding: 0, fontSize: 13 }}
      >
        Choose manually below
      </button>
    </div>
  );
}
