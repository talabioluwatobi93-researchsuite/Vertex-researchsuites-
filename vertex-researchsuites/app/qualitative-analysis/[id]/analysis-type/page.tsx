'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type AnalysisType = 'thematic' | 'content'

const ANALYSIS_INFO: Record<AnalysisType, { label: string; description: string }> = {
  thematic: {
    label: 'Thematic Analysis',
    description: 'Groups your data into recurring themes, illustrated with direct quotes \u2014 the qualitative equivalent of finding patterns in your respondents\u2019 own words.'
  },
  content: {
    label: 'Content Analysis',
    description: 'Counts how often each theme appears across your transcript, giving a frequency-based view of what matters most to your respondents.'
  }
}

export default function QualAnalysisTypePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [themeCount, setThemeCount] = useState(0)
  const [quoteCount, setQuoteCount] = useState(0)
  const [selected, setSelected] = useState<AnalysisType[]>([])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('qualitative_analysis_sessions')
        .select('themes, quote_assignments, analysis_type')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please go back and complete the coding review first.')
        setLoading(false)
        return
      }

      setThemeCount((data.themes || []).length)
      setQuoteCount((data.quote_assignments || []).length)
      if (data.analysis_type && Array.isArray(data.analysis_type)) {
        setSelected(data.analysis_type)
      }
      setLoading(false)
    }
    load()
  }, [sessionId])

  const availability: Record<AnalysisType, { available: boolean; reason: string }> = {
    thematic: {
      available: themeCount > 0 && quoteCount > 0,
      reason: 'Requires at least one theme with a confirmed quote.'
    },
    content: {
      available: themeCount > 0 && quoteCount >= themeCount,
      reason: 'Requires enough coded quotes to count theme frequency meaningfully.'
    }
  }

  const toggleType = (type: AnalysisType) => {
    if (!availability[type].available) return
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const handleContinue = async () => {
    if (selected.length === 0) {
      setErrorMsg('Please select at least one type of analysis to continue.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('qualitative_analysis_sessions')
      .update({ analysis_type: selected, status: 'analysis_selected', updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg('Something went wrong saving this step. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/qualitative-analysis/${sessionId}/results`)
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
        <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Choose Your Analysis</h1>
        <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
          Step 5 of 10 &mdash; Based on your coded data, select the type(s) of analysis you need. You can choose both.
        </p>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Your Coded Data</p>
          <p style={{ color: '#777777', fontSize: '12px', margin: 0 }}>
            {themeCount} theme{themeCount !== 1 ? 's' : ''} &middot; {quoteCount} confirmed quote{quoteCount !== 1 ? 's' : ''}
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
                backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px',
                border: isSelected ? '2px solid #D4AF37' : '1px solid #EEEEEE', marginBottom: '12px',
                opacity: avail.available ? 1 : 0.5, cursor: avail.available ? 'pointer' : 'not-allowed'
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
          style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Continue to Results'}
        </button>
      </div>
    </div>
  )
}
