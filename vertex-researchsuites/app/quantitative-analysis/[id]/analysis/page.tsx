'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type AnalysisType = 'descriptive' | 'correlation' | 'regression'
type Construct = { id: string; name: string; role: string; columnIndexes: number[] }

const ANALYSIS_INFO: Record<AnalysisType, { label: string; description: string }> = {
  descriptive: {
    label: 'Descriptive Statistics',
    description: 'Summarizes each construct with Mean, SD, Min, and Max — the foundation for every study.'
  },
  correlation: {
    label: 'Correlation Analysis',
    description: 'Measures the strength and direction of relationships between two or more constructs.'
  },
  regression: {
    label: 'Regression Analysis',
    description: 'Tests how well your Independent Variable(s) predict your Dependent Variable, with a full 4-table output (Variables Entered/Removed, Model Summary, ANOVA, Coefficients).'
  }
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

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('quantitative_analysis_sessions')
        .select('constructs, analysis_type')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please go back and complete column mapping first.')
        setLoading(false)
        return
      }

      setConstructs(data.constructs || [])
      if (data.analysis_type && Array.isArray(data.analysis_type)) {
        setSelected(data.analysis_type)
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

  const availability: Record<AnalysisType, { available: boolean; reason: string }> = {
    descriptive: {
      available: constructs.length > 0,
      reason: 'No constructs found. Please complete column mapping first.'
    },
    correlation: {
      available: ivCount + dvCount >= 2,
      reason: 'Requires at least two IV/DV constructs to correlate.'
    },
    regression: {
      available: ivCount >= 1 && dvCount >= 1,
      reason: 'Requires at least one Independent Variable and one Dependent Variable.'
    }
  }

  const toggleType = (type: AnalysisType) => {
    if (!availability[type].available) return
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
    if (type === 'regression') setModelConfirmed(false)
  }

  const regressionSelected = selected.includes('regression')
  const correlationSelected = selected.includes('correlation')

  const handleContinue = async () => {
    if (selected.length === 0) {
      setErrorMsg('Please select at least one type of analysis to continue.')
      return
    }
    if (regressionSelected && !modelConfirmed) {
      setErrorMsg('Please confirm your research model before continuing.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({
        analysis_type: selected,
        status: 'analysis_selected',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg('Something went wrong saving this step. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/sections`)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F9F9F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9F9F9', padding: '24px 16px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
          Choose Your Analysis
        </h1>
        <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
          Step 8 of 10 &mdash; Based on your constructs, select the type(s) of analysis you need. You can choose more than one.
        </p>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Your Constructs</p>
          <p style={{ color: '#777777', fontSize: '12px', margin: 0 }}>
            {ivCount} Independent Variable{ivCount !== 1 ? 's' : ''} &middot; {dvCount} Dependent Variable{dvCount !== 1 ? 's' : ''}
            {hasDemographic ? ' · Demographics included' : ''}
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
                <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                  <p style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                    We'll test whether {ivConstructs.map((c) => c.name).join(' and ')} predict{ivConstructs.length === 1 ? 's' : ''} {dvConstructs[0]?.name}.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <input type="checkbox" checked={modelConfirmed} onChange={(e) => setModelConfirmed(e.target.checked)} style={{ marginTop: '2px' }} />
                    <span style={{ color: '#555555', fontSize: '12px' }}>Yes, this is correct.</span>
                  </label>
                </div>
              )}
            </div>
          )
        })}

        {errorMsg && (
          <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={saving}
          style={{
            width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none',
            borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
          }}
        >
          {saving ? 'Saving...' : 'Continue to Section Mapping'}
        </button>
      </div>
    </div>
  )
}
