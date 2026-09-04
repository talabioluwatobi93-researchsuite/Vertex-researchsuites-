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
  columnIndexes: number[]
  reverseIndexes: number[]
  scaleMin: number
  scaleMax: number
  scaleReversed: boolean
  presetLabel: string
}

type RangeSel = { from: number | ''; to: number | '' }

const PRESETS: { label: string; min: number; max: number }[] = [
  { label: '5-point: Strongly Disagree → Strongly Agree', min: 1, max: 5 },
  { label: '5-point: Never → Always', min: 1, max: 5 },
  { label: '5-point: Very Dissatisfied → Very Satisfied', min: 1, max: 5 },
  { label: '4-point: Strongly Disagree → Strongly Agree (no neutral)', min: 1, max: 4 },
  { label: '7-point: Strongly Disagree → Strongly Agree', min: 1, max: 7 },
  { label: 'Yes / No (binary)', min: 1, max: 2 },
  { label: 'Custom', min: 1, max: 5 },
]

export default function ColumnsPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [columnHeaders, setColumnHeaders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [constructs, setConstructs] = useState<Construct[]>([])
  const [ranges, setRanges] = useState<Record<string, RangeSel>>({})
  const [newConstructName, setNewConstructName] = useState('')
  const [newConstructIsDemo, setNewConstructIsDemo] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('quantitative_analysis_sessions')
        .select('column_headers')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please upload your file again.')
        setLoading(false)
        return
      }
      setColumnHeaders(data.column_headers || [])
      setLoading(false)
    }
    load()
  }, [sessionId])

  const addConstruct = () => {
    const name = newConstructName.trim()
    if (!name) return
    const id = `c_${Date.now()}`
    setConstructs([
      ...constructs,
      {
        id, name,
        role: newConstructIsDemo ? 'Demographic' : 'Unassigned',
        columnIndexes: [], reverseIndexes: [],
        scaleMin: 1, scaleMax: 5, scaleReversed: false, presetLabel: PRESETS[0].label
      }
    ])
    setRanges((prev) => ({ ...prev, [id]: { from: '', to: '' } }))
    setNewConstructName('')
    setNewConstructIsDemo(false)
  }

  const updateRange = (constructId: string, part: 'from' | 'to', value: string) => {
    const numVal = value === '' ? '' : Number(value)
    const nextRange = { ...(ranges[constructId] || { from: '', to: '' }), [part]: numVal }
    setRanges((prev) => ({ ...prev, [constructId]: nextRange }))

    if (nextRange.from !== '' && nextRange.to !== '') {
      const from = Math.min(nextRange.from as number, nextRange.to as number)
      const to = Math.max(nextRange.from as number, nextRange.to as number)
      const indexes: number[] = []
      for (let i = from; i <= to; i++) indexes.push(i)
      setConstructs((prev) =>
        prev.map((c) => (c.id === constructId ? { ...c, columnIndexes: indexes, reverseIndexes: c.reverseIndexes.filter((r) => indexes.includes(r)) } : c))
      )
    }
  }

  const toggleReverse = (colIndex: number, constructId: string) => {
    setConstructs((prev) =>
      prev.map((c) => {
        if (c.id !== constructId) return c
        const isReversed = c.reverseIndexes.includes(colIndex)
        return {
          ...c,
          reverseIndexes: isReversed ? c.reverseIndexes.filter((i) => i !== colIndex) : [...c.reverseIndexes, colIndex]
        }
      })
    )
  }

  const updatePreset = (constructId: string, presetLabel: string) => {
    const preset = PRESETS.find((p) => p.label === presetLabel)
    if (!preset) return
    setConstructs((prev) =>
      prev.map((c) => (c.id === constructId ? { ...c, presetLabel, scaleMin: preset.min, scaleMax: preset.max } : c))
    )
  }

  const updateCustomScale = (constructId: string, part: 'scaleMin' | 'scaleMax', value: string) => {
    const num = Number(value)
    setConstructs((prev) => prev.map((c) => (c.id === constructId ? { ...c, [part]: num } : c)))
  }

  const toggleScaleReversed = (constructId: string) => {
    setConstructs((prev) => prev.map((c) => (c.id === constructId ? { ...c, scaleReversed: !c.scaleReversed } : c)))
  }

  const scaleConstructs = constructs.filter((c) => c.role !== 'Demographic')
  const demoConstructs = constructs.filter((c) => c.role === 'Demographic')

  function toggleIV(constructId: string) {
    setConstructs((prev) =>
      prev.map((c) => {
        if (c.id !== constructId) return c
        if (c.role === 'IV') return { ...c, role: 'Unassigned' }
        return { ...c, role: 'IV' }
      })
    )
  }

  function setDV(constructId: string) {
    setConstructs((prev) =>
      prev.map((c) => {
        if (c.id === constructId) return { ...c, role: 'DV' }
        if (c.role === 'DV') return { ...c, role: 'Unassigned' }
        return c
      })
    )
  }

  const handleSave = async () => {
    const usedConstructs = constructs.filter((c) => c.columnIndexes.length > 0)

    if (usedConstructs.length === 0) {
      setErrorMsg('Please create at least one construct and set its column range.')
      return
    }

    const hasIV = usedConstructs.some((c) => c.role === 'IV')
    const hasDV = usedConstructs.some((c) => c.role === 'DV')
    if (!hasIV || !hasDV) {
      setErrorMsg('You need at least one Independent Variable (IV) and one Dependent Variable (DV) construct.')
      return
    }

    const badScale = usedConstructs.find((c) => c.role !== 'Demographic' && (c.scaleMin === undefined || c.scaleMax === undefined || c.scaleMin >= c.scaleMax))
    if (badScale) {
      setErrorMsg(`Please check the scale range for "${badScale.name}" — minimum must be less than maximum.`)
      return
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({
        constructs: usedConstructs,
        status: 'mapped',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg('Something went wrong saving your setup. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/reliability`)
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>Loading your data...</p>
      </div>
    )
  }

  const roleColor = (role: string) => (role === 'IV' ? '#D4AF37' : role === 'DV' ? '#2E7D32' : role === 'Demographic' ? '#777777' : '#B0B0B0')

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
        Group Your Items
      </h1>
      <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
        Step 4, 5 &amp; 6 of 10 &mdash; Name your constructs, set their ranges, and choose each one's scale.
      </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Your constructs &amp; demographic sections</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="e.g. Credibility"
            value={newConstructName}
            onChange={(e) => setNewConstructName(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }}
          />
          <button onClick={addConstruct} style={{ backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Add
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <input type="checkbox" checked={newConstructIsDemo} onChange={(e) => setNewConstructIsDemo(e.target.checked)} />
          <span style={{ color: '#777777', fontSize: '12px' }}>This is a Demographic section (not part of IV/DV analysis)</span>
        </label>
        <p style={{ color: '#777777', fontSize: '12px', marginTop: '10px' }}>
          Total constructs: {constructs.length} &nbsp;|&nbsp; Demographic sections: {demoConstructs.length}
        </p>
      </div>

      {constructs.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Set each section's range &amp; scale</p>
          <p style={{ color: '#777777', fontSize: '12px', marginBottom: '14px' }}>
            Pick the first and last question, then (for constructs, not demographics) choose the scale used.
          </p>
          {constructs.map((c) => {
            const r = ranges[c.id] || { from: '', to: '' }
            return (
              <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid #F0F0F0' }}>
                <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  {c.name} <span style={{ color: roleColor(c.role), fontWeight: 700, fontSize: '11px' }}>({c.role})</span>
                </p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select
                    value={r.from}
                    onChange={(e) => updateRange(c.id, 'from', e.target.value)}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
                  >
                    <option value="">From...</option>
                    {columnHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>{h}</option>
                    ))}
                  </select>
                  <select
                    value={r.to}
                    onChange={(e) => updateRange(c.id, 'to', e.target.value)}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
                  >
                    <option value="">To...</option>
                    {columnHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>{h}</option>
                    ))}
                  </select>
                </div>
                {c.columnIndexes.length > 0 && (
                  <p style={{ color: '#777777', fontSize: '11px', marginBottom: '8px' }}>
                    {c.columnIndexes.length} question{c.columnIndexes.length !== 1 ? 's' : ''} included
                  </p>
                )}

                {c.role !== 'Demographic' && (
                  <div style={{ backgroundColor: '#F9F9F9', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                    <label style={{ color: '#333333', fontSize: '11px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Scale used</label>
                    <select
                      value={c.presetLabel}
                      onChange={(e) => updatePreset(c.id, e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333', marginBottom: '8px' }}
                    >
                      {PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>{p.label}</option>
                      ))}
                    </select>
                    {c.presetLabel === 'Custom' && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <input type="number" value={c.scaleMin} onChange={(e) => updateCustomScale(c.id, 'scaleMin', e.target.value)} style={{ width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE' }} />
                        <span style={{ color: '#777777', fontSize: '12px' }}>to</span>
                        <input type="number" value={c.scaleMax} onChange={(e) => updateCustomScale(c.id, 'scaleMax', e.target.value)} style={{ width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE' }} />
                      </div>
                    )}
                    <p style={{ color: '#777777', fontSize: '11px', marginBottom: '6px' }}>
                      Numbers used: {c.scaleMin} to {c.scaleMax}
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={c.scaleReversed} onChange={() => toggleScaleReversed(c.id)} />
                      <span style={{ color: '#777777', fontSize: '11px' }}>Reverse this scale (e.g. my questionnaire uses 1 = Agree, not 1 = Disagree)</span>
                    </label>
                  </div>
                )}

                {c.role !== 'Demographic' && c.columnIndexes.map((idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', paddingLeft: '4px' }}>
                    <input type="checkbox" checked={c.reverseIndexes.includes(idx)} onChange={() => toggleReverse(idx, c.id)} />
                    <span style={{ color: '#777777', fontSize: '11px' }}>{columnHeaders[idx]} &mdash; reverse-worded item?</span>
                  </label>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {scaleConstructs.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Declare your research model</p>
          <p style={{ color: '#777777', fontSize: '12px', marginBottom: '14px' }}>
            Choose which constructs are your Independent Variable(s) and which is your Dependent Variable.
          </p>

          <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            Independent Variable(s)
          </label>
          <div style={{ marginBottom: '16px' }}>
            {scaleConstructs.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <input type="checkbox" checked={c.role === 'IV'} onChange={() => toggleIV(c.id)} />
                <span style={{ color: '#333333', fontSize: '13px' }}>{c.name}</span>
              </label>
            ))}
          </div>

          <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            Dependent Variable
          </label>
          <div>
            {scaleConstructs.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <input type="radio" name="dv" checked={c.role === 'DV'} onChange={() => setDV(c.id)} />
                <span style={{ color: '#333333', fontSize: '13px' }}>{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
      >
        {saving ? 'Saving...' : 'Continue to Analysis'}
      </button>
    </div>
  )
}
