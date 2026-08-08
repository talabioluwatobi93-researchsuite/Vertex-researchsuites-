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
}

export default function ColumnsPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [columnHeaders, setColumnHeaders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [constructs, setConstructs] = useState<Construct[]>([])
  const [assignments, setAssignments] = useState<Record<number, string>>({})
  const [newConstructName, setNewConstructName] = useState('')
  const [newConstructIsDemo, setNewConstructIsDemo] = useState(false)
  const [scaleMin, setScaleMin] = useState(1)
  const [scaleMax, setScaleMax] = useState(5)

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
      { id, name, role: newConstructIsDemo ? 'Demographic' : 'Unassigned', columnIndexes: [], reverseIndexes: [] }
    ])
    setNewConstructName('')
    setNewConstructIsDemo(false)
  }

  const assignColumn = (colIndex: number, constructId: string) => {
    setAssignments((prev) => ({ ...prev, [colIndex]: constructId }))
    setConstructs((prev) =>
      prev.map((c) => {
        const withoutCol = c.columnIndexes.filter((i) => i !== colIndex)
        if (c.id === constructId) return { ...c, columnIndexes: [...withoutCol, colIndex] }
        return { ...c, columnIndexes: withoutCol }
      })
    )
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
      setErrorMsg('Please create at least one construct and assign columns to it.')
      return
    }

    const hasIV = usedConstructs.some((c) => c.role === 'IV')
    const hasDV = usedConstructs.some((c) => c.role === 'DV')
    if (!hasIV || !hasDV) {
      setErrorMsg('You need at least one Independent Variable (IV) and one Dependent Variable (DV) construct.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({
        constructs: usedConstructs,
        cleaning_config: { scaleMin, scaleMax },
        status: 'mapped',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg('Something went wrong saving your setup. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/analysis`)
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
        Step 4 of 10 &mdash; Name your constructs, then declare your Independent and Dependent Variables.
      </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Scale used</p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="number" value={scaleMin} onChange={(e) => setScaleMin(Number(e.target.value))} style={{ width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE' }} />
          <span style={{ color: '#777777', fontSize: '13px' }}>to</span>
          <input type="number" value={scaleMax} onChange={(e) => setScaleMax(Number(e.target.value))} style={{ width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE' }} />
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Your constructs</p>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
          <input type="checkbox" checked={newConstructIsDemo} onChange={(e) => setNewConstructIsDemo(e.target.checked)} />
          <span style={{ color: '#777777', fontSize: '12px' }}>This is a Demographic variable (not part of IV/DV analysis)</span>
        </label>
        {constructs.map((c) => (
          <span key={c.id} style={{ display: 'inline-block', backgroundColor: '#F9F9F9', border: `1px solid ${roleColor(c.role)}`, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#333333', marginRight: '6px', marginBottom: '6px' }}>
            {c.name} <span style={{ color: roleColor(c.role), fontWeight: 700 }}>({c.role})</span> ({c.columnIndexes.length})
          </span>
        ))}
        <p style={{ color: '#777777', fontSize: '12px', marginTop: '10px' }}>
          Total constructs: {constructs.length} &nbsp;|&nbsp; Demographic sections: {demoConstructs.length}
        </p>
      </div>

      {scaleConstructs.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Declare your research model</p>
          <p style={{ color: '#777777', fontSize: '12px', marginBottom: '14px' }}>
            Based on what you told us earlier, choose which constructs are your Independent Variable(s) and which is your Dependent Variable.
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

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Assign each column</p>
        {columnHeaders.map((header, idx) => {
          const assignedId = assignments[idx] || ''
          const assignedConstruct = constructs.find((c) => c.id === assignedId)
          return (
            <div key={idx} style={{ padding: '10px 0', borderBottom: idx < columnHeaders.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
              <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{header}</p>
              <select
                value={assignedId}
                onChange={(e) => assignColumn(idx, e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
                disabled={constructs.length === 0}
              >
                <option value="">Exclude (not used)</option>
                {constructs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                ))}
              </select>
              {assignedConstruct && assignedConstruct.role !== 'Demographic' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <input type="checkbox" checked={assignedConstruct.reverseIndexes.includes(idx)} onChange={() => toggleReverse(idx, assignedConstruct.id)} />
                  <span style={{ color: '#777777', fontSize: '11px' }}>This item is reverse-worded</span>
                </label>
              )}
            </div>
          )
        })}
      </div>

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
