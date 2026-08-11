'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type AnalysisType = 'descriptive' | 'correlation' | 'regression' | 'ttest'
type Construct = { id: string; name: string; role: string; columnIndexes: number[] }

const ANALYSIS_INFO: Record<AnalysisType, { label: string; description: string }> = {
  descriptive: {
    label: 'Descriptive Statistics',
    description: 'Summarizes each construct with Mean, SD, Min, and Max — the foundation for every study.',
  },
  correlation: {
    label: 'Correlation Analysis',
    description: 'Measures the strength and direction of relationships between two or more constructs.',
  },
  regression: {
    label: 'Regression Analysis',
    description: 'Tests how well your Independent Variable(s) predict your Dependent Variable, with a full 4-table output (Variables Entered/Removed, Model Summary, ANOVA, Coefficients).',
  },
  ttest: {
    label: 'Independent Samples T-Test',
    description: 'Compares the mean of a variable between exactly two groups (e.g., Male vs Female), with Levene\u2019s Test and full SPSS-style output.',
  },
}

export default function AnalysisTypePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [constructs, setConstructs] = useState<Construct[]>([])
  const [selected, setSelected] = useState<AnalysisType[]>([])
  const [modelConfirmed, setModelConfirmed] = useState(false)

  const [rawData, setRawData] = useState<any[][]>([])
  const [ttestGroupId, setTtestGroupId] = useState('')
  const [ttestOutcomeId, setTtestOutcomeId] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('quantitative_analysis_sessions')
        .select('constructs, analysis_type, raw_data, ttest_config')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please go back and complete column mapping first.')
        setLoading(false)
        return
      }

      setConstructs(data.constructs || [])
      setRawData(data.raw_data || [])
      if (data.analysis_type && Array.isArray(data.analysis_type)) {
        setSelected(data.analysis_type)
      }
      if (data.ttest_config) {
        setTtestGroupId(data.ttest_config.groupConstructId || '')
        setTtestOutcomeId(data.ttest_config.outcomeConstructId || '')
      }
      setLoading(false)
    }
    load()
  }, [sessionId])

  const ivConstructs = constructs.filter((c) => c.role === 'IV')
  const dvConstructs = constructs.filter((c) => c.role === 'DV')
  const ivCount = ivConstructs.length
  const dvCount = dvConstructs.length
  const hasDemographic = constructs.some((c) => c.role === 'Demographic')

  // A construct is eligible as a t-test grouping variable only if it uses
  // exactly ONE column (matches SPSS: every variable is a single column)
  // AND that column has exactly 2 distinct non-empty values in the data.
  function getDistinctValues(colIndex: number): string[] {
    const seen = new Set<string>()
    rawData.forEach((row) => {
      const val = row[colIndex]
      if (val === null || val === undefined || String(val).trim() === '') return
      seen.add(String(val).trim())
    })
    return Array.from(seen)
  }

  const groupEligibleConstructs = constructs
    .filter((c) => c.columnIndexes && c.columnIndexes.length === 1)
    .map((c) => ({ ...c, distinctValues: getDistinctValues(c.columnIndexes[0]) }))
    .filter((c) => c.distinctValues.length === 2)

  // Outcome variable for t-test: any construct NOT chosen as the grouping variable
  const outcomeEligibleConstructs = constructs.filter((c) => c.id !== ttestGroupId)

  const availability: Record<AnalysisType, { available: boolean; reason: string }> = {
    descriptive: {
      available: constructs.length > 0,
      reason: 'No constructs found. Please complete column mapping first.',
    },
    correlation: {
      available: constructs.filter((c) => c.role === 'IV' || c.role === 'DV').length >= 2,
      reason: 'Need at least 2 IV/DV constructs to correlate.',
    },
    regression: {
      available: ivCount >= 1 && dvCount === 1,
      reason: 'Need at least 1 Independent Variable and exactly 1 Dependent Variable.',
    },
    ttest: {
      available: groupEligibleConstructs.length > 0 && constructs.length >= 2,
      reason: 'Need a single-column variable with exactly 2 distinct values (e.g., Gender) to group by.',
    },
  }

  function toggleType(type: AnalysisType) {
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
    setErrorMsg('')
  }

  async function handleContinue() {
    if (selected.length === 0) {
      setErrorMsg('Please select at least one analysis type.')
      return
    }

    if (selected.includes('regression') && !modelConfirmed) {
      setErrorMsg('Please confirm your regression model before continuing.')
      return
    }

    if (selected.includes('ttest')) {
      if (!ttestGroupId) {
        setErrorMsg('Please choose a grouping variable for the t-test (must have exactly 2 groups).')
        return
      }
      if (!ttestOutcomeId) {
        setErrorMsg('Please choose an outcome variable for the t-test.')
        return
      }
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({
        analysis_type: selected,
        ttest_config: selected.includes('ttest')
          ? { groupConstructId: ttestGroupId, outcomeConstructId: ttestOutcomeId }
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg('Something went wrong saving your analysis selection. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/sections`)
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>Loading your data...</p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
        Choose Your Analysis
      </h1>
      <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
        Step 8 of 10 — Based on your constructs, select the type(s) of analysis you need. You can choose more than one.
      </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Your Constructs</p>
        <p style={{ color: '#777777', fontSize: '12px', margin: 0 }}>
          {ivCount} Independent Variable{ivCount !== 1 ? 's' : ''} &middot; {dvCount} Dependent Variable{dvCount !== 1 ? 's' : ''}
          {hasDemographic ? ' \u00b7 Demographics included' : ''}
        </p>
      </div>

      {Object.keys(ANALYSIS_INFO).map((type) => {
        const info = ANALYSIS_INFO[type as AnalysisType]
        const avail = availability[type as AnalysisType]
        const isSelected = selected.includes(type as AnalysisType)

        return (
          <div
            key={type}
            onClick={() => toggleType(type as AnalysisType)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '16px',
              border: isSelected ? '2px solid #D4AF37' : '1px solid #EEEEEE',
              marginBottom: '12px',
              opacity: avail.available ? 1 : 0.5,
              cursor: avail.available ? 'pointer' : 'not-allowed',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ color: '#333333', fontSize: '14px', fontWeight: 700, margin: 0 }}>{info.label}</p>
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!avail.available}
                onChange={() => toggleType(type as AnalysisType)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <p style={{ color: '#777777', fontSize: '12px', margin: 0 }}>
              {avail.available ? info.description : avail.reason}
            </p>

            {type === 'correlation' && isSelected && avail.available && (
              <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '10px 12px', marginTop: '10px' }}>
                <p style={{ color: '#333333', fontSize: '12px', margin: 0 }}>
                  We'll correlate: {[...ivConstructs, ...dvConstructs].map((c) => c.name).join(', ')}
                </p>
              </div>
            )}

            {type === 'regression' && isSelected && avail.available && (
              <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '10px 12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                <p style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  We'll test whether {ivConstructs.map((c) => c.name).join(' and ')} predict{ivConstructs.length === 1 ? 's' : ''} {dvConstructs[0]?.name}.
                </p>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <input type="checkbox" checked={modelConfirmed} onChange={(e) => setModelConfirmed(e.target.checked)} style={{ marginTop: '2px' }} />
                  <span style={{ color: '#555555', fontSize: '12px' }}>Yes, this is correct.</span>
                </label>
              </div>
            )}

            {type === 'ttest' && isSelected && avail.available && (
              <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Grouping variable (must have exactly 2 groups)
                </label>
                <select
                  value={ttestGroupId}
                  onChange={(e) => { setTtestGroupId(e.target.value); if (ttestOutcomeId === e.target.value) setTtestOutcomeId('') }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333', marginBottom: '10px' }}
                >
                  <option value="">Select a grouping variable...</option>
                  {groupEligibleConstructs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.distinctValues.join(' vs ')})</option>
                  ))}
                </select>

                <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Outcome variable (what you're comparing)
                </label>
                <select
                  value={ttestOutcomeId}
                  onChange={(e) => setTtestOutcomeId(e.target.value)}
                  disabled={!ttestGroupId}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
                >
                  <option value="">Select an outcome variable...</option>
                  {outcomeEligibleConstructs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {ttestGroupId && ttestOutcomeId && (
                  <p style={{ color: '#777777', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>
                    We'll compare {outcomeEligibleConstructs.find((c) => c.id === ttestOutcomeId)?.name} between the two groups of {groupEligibleConstructs.find((c) => c.id === ttestGroupId)?.name}.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {errorMsg && (
        <div style={{ backgroundColor: '#FDECEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={saving}
        style={{
          width: '100%',
          backgroundColor: '#D4AF37',
          color: '#333333',
          border: 'none',
          borderRadius: '10px',
          padding: '14px',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {saving ? 'Saving...' : 'Continue to Section Mapping'}
      </button>
    </div>
  )
}
