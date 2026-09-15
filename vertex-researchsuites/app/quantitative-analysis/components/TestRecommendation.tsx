'use client';

import { useState, useEffect } from 'react';

interface RecommendationResult {
  appRecommendation: { test: string; reason: string };
  userPlan: {
    suggestedTest: string;
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
              <strong style={{ fontSize: 13 }}>Based on Your Stated Plan: {result.userPlan.suggestedTest}</strong>
              <p style={{ fontSize: 13, color: '#444', margin: '6px 0' }}>{result.userPlan.reasoning}</p>
              <p style={{ fontSize: 12, color: result.userPlan.eligible ? '#0a7d2f' : '#b00020' }}>
                {result.userPlan.eligibilityNote}
              </p>
              {result.userPlan.eligible && (
                <button onClick={() => onSelect(result.userPlan!.suggestedTest)}>Use this test</button>
              )}
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
