'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type Construct = {
  id: string
  name: string
  role: 'IV' | 'DV' | 'Demographic' | 'Unassigned'
}

type AlphaRow = { id: string; name: string; role: string; alpha: string }

export default function ReliabilityPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [rows, setRows] = useState<AlphaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('quantitative_analysis_sessions')
        .select('constructs')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load your constructs. Please go back and check your construct tagging.')
        setLoading(false)
        return
      }

      const constructs: Construct[] = data.constructs || []
      const scaleConstructs = constructs.filter(c => c.role !== 'Demographic')

      if (scaleConstructs.length === 0) {
        setErrorMsg('No scale-based constructs found. Please go back and check your construct tagging.')
        setLoading(false)
        return
      }

      setRows(scaleConstructs.map(c => ({ id: c.id, name: c.name, role: c.role, alpha: '' })))
      setLoading(false)
    }
    load()
  }, [sessionId])

  const updateAlpha = (id: string, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, alpha: value } : r))
  }

  const roleColor = (role: string) =>
    role === 'IV' ? '#D4AF37' : role === 'DV' ? '#2E7D32' : '#B0B0B0'

  const handleContinue = async () => {
    if (rows.some(r => !r.alpha.trim())) {
      setErrorMsg('Please enter a Cronbach\u2019s Alpha value for every construct.')
      return
    }

    const parsed = rows.map(r => ({ ...r, alphaNum: Number(r.alpha) }))
    if (parsed.some(r => isNaN(r.alphaNum) || r.alphaNum < 0 || r.alphaNum > 1)) {
      setErrorMsg('Cronbach\u2019s Alpha must be a number between 0 and 1 (e.g. 0.842).')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const reliabilityInfo = {
      constructs: parsed.map(r => ({
        id: r.id,
        name: r.name,
        role: r.role,
        cronbach_alpha: Math.round(r.alphaNum * 1000) / 1000,
      })),
    }

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({ reliability_info: reliabilityInfo })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg(`Save failed: ${error.message}`)
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/analysis`)
  }

  if (loading) {
    return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>Loading your constructs...</div>
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Reliability of Your Research Instrument</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Enter the Cronbach&rsquo;s Alpha from your pilot study for each construct below. This confirms your questionnaire passed reliability testing before the main analysis.
      </p>

      {rows.length > 0 && (
        <div style={{ border: '1px solid #e2e2e2', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: roleColor(r.role) }}>{r.role}</div>
              </div>
              <input
                type="number"
                step="0.001"
                min="0"
                max="1"
                placeholder="e.g. 0.842"
                value={r.alpha}
                onChange={e => updateAlpha(r.id, e.target.value)}
                style={{ width: 100, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
              />
            </div>
          ))}
          <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            Conventionally, an Alpha of 0.70 or higher indicates acceptable reliability. Lower values will still be accepted and reported honestly in your discussion.
          </p>
        </div>
      )}

      {errorMsg && (
        <p style={{ color: '#c0392b', background: '#fdecea', padding: 10, borderRadius: 6, marginBottom: 16 }}>{errorMsg}</p>
      )}

      <button
        onClick={handleContinue}
        disabled={saving || rows.length === 0}
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 8,
          border: 'none',
          background: '#e6b800',
          fontWeight: 700,
          fontSize: 16,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving...' : 'Continue'}
      </button>
    </div>
  )
}
