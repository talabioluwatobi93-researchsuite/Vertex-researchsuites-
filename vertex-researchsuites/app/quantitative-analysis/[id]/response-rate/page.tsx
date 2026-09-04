'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type LocationRow = { area: string; count: string }

export default function ResponseRatePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [method, setMethod] = useState('Physical')
  const [methodOther, setMethodOther] = useState('')
  const [locations, setLocations] = useState<LocationRow[]>([{ area: '', count: '' }])
  const [totalReturned, setTotalReturned] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const totalAdministered = locations.reduce((sum, l) => sum + (Number(l.count) || 0), 0)
  const returnedNum = Number(totalReturned) || 0
  const responseRate = totalAdministered > 0 ? Math.round((returnedNum / totalAdministered) * 1000) / 10 : 0

  const updateLocation = (idx: number, field: 'area' | 'count', value: string) => {
    setLocations(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const addLocation = () => {
    setLocations(prev => [...prev, { area: '', count: '' }])
  }

  const removeLocation = (idx: number) => {
    setLocations(prev => prev.filter((_, i) => i !== idx))
  }

  const handleContinue = async () => {
    if (locations.some(l => !l.area.trim() || !l.count.trim())) {
      setErrorMsg('Please fill in every location and its count, or remove empty rows.')
      return
    }
    if (!totalReturned.trim()) {
      setErrorMsg('Please enter the total number of responses returned.')
      return
    }
    if (returnedNum > totalAdministered) {
      setErrorMsg('Returned responses cannot be more than administered responses.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const responseRateInfo = {
      method: method === 'Other' ? methodOther.trim() : method,
      locations: locations.map(l => ({ area: l.area.trim(), count: Number(l.count) })),
      total_administered: totalAdministered,
      total_returned: returnedNum,
      response_rate_percent: responseRate,
    }

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({ response_rate_info: responseRateInfo })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg(`Save failed: ${error.message}`)
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/cross-checks`)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Questionnaire Administration &amp; Response Rate</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Tell us how your questionnaire was administered so we can calculate your response rate.</p>

      <div style={{ border: '1px solid #e2e2e2', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Method of administration</label>
        <select value={method} onChange={e => setMethod(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}>
          <option value="Physical">Physical (printed copies)</option>
          <option value="Google Forms">Google Forms</option>
          <option value="Other">Other</option>
        </select>
        {method === 'Other' && (
          <input
            type="text"
            placeholder="Describe how it was administered"
            value={methodOther}
            onChange={e => setMethodOther(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', marginTop: 8 }}
          />
        )}
      </div>

      <div style={{ border: '1px solid #e2e2e2', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Where was it distributed?</label>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Add each location and how many questionnaires were given out there. These will be added together automatically.</p>

        {locations.map((loc, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="e.g. Faculty of Arts, UNILORIN"
              value={loc.area}
              onChange={e => updateLocation(idx, 'area', e.target.value)}
              style={{ flex: 2, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
            />
            <input
              type="number"
              placeholder="Count"
              value={loc.count}
              onChange={e => updateLocation(idx, 'count', e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
            />
            {locations.length > 1 && (
              <button onClick={() => removeLocation(idx)} style={{ padding: '0 12px', border: '1px solid #ccc', borderRadius: 6, background: '#fff' }}>✕</button>
            )}
          </div>
        ))}

        <button onClick={addLocation} style={{ marginTop: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#f9f9f9' }}>+ Add another location</button>

        <p style={{ marginTop: 12, fontWeight: 600 }}>Total administered: {totalAdministered}</p>
      </div>

      <div style={{ border: '1px solid #e2e2e2', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Total number returned</label>
        <input
          type="number"
          placeholder="e.g. 401"
          value={totalReturned}
          onChange={e => setTotalReturned(e.target.value)}
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
        {totalAdministered > 0 && totalReturned && (
          <p style={{ marginTop: 12, fontWeight: 600 }}>Response rate: {responseRate}%</p>
        )}
      </div>

      {errorMsg && (
        <p style={{ color: '#c0392b', background: '#fdecea', padding: 10, borderRadius: 6, marginBottom: 16 }}>{errorMsg}</p>
      )}

      <button
        onClick={handleContinue}
        disabled={saving}
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
