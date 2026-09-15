'use client';

import { useState } from 'react';

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
  session,
  constructScores,
  onSelect,
  onManual,
}: {
  sessionId: string;
  session: any;
  constructScores: Record<string, number[]>;
  onSelect: (test: string) => void;
  onManual: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchRecommendation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/quantitative-analysis/recommend-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, session, constructScores }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Failed to get recommendation');
    } finally {
      setLoading(false);
    }
  }

  if (!result && !loading && !error) {
    fetchRecommendation();
  }

  return (
    <div style={{ padding: 24, border: '1px solid #ddd', borderRadius: 8, maxWidth: 640 }}>
      <h3 style={{ marginTop: 0 }}>Which test should you run?</h3>

      {loading && <p>Analyzing your data and research plan...</p>}
      {error && <p style={{ color: '#b00020' }}>{error}</p>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16 }}>
            <strong>App's Recommendation: {result.appRecommendation.test}</strong>
            <p style={{ fontSize: 14, color: '#444' }}>{result.appRecommendation.reason}</p>
            <button onClick={() => onSelect(result.appRecommendation.test)}>
              Use this test
            </button>
          </div>

          {result.userPlan && (
            <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16 }}>
              <strong>Based on Your Stated Plan: {result.userPlan.suggestedTest}</strong>
              <p style={{ fontSize: 14, color: '#444' }}>{result.userPlan.reasoning}</p>
              <p style={{ fontSize: 13, color: result.userPlan.eligible ? '#0a7d2f' : '#b00020' }}>
                {result.userPlan.eligibilityNote}
              </p>
              {result.userPlan.eligible && (
                <button onClick={() => onSelect(result.userPlan!.suggestedTest)}>
                  Use this test
                </button>
              )}
            </div>
          )}

          {!result.userPlan && (
            <p style={{ fontSize: 13, color: '#777' }}>
              No research questions/hypotheses were provided at upload, so only the
              data-driven recommendation is shown above.
            </p>
          )}
        </div>
      )}

      <button
        onClick={onManual}
        style={{ marginTop: 16, background: 'none', border: 'none', color: '#0645AD', cursor: 'pointer', padding: 0 }}
      >
        Choose manually instead
      </button>
    </div>
  );
}
