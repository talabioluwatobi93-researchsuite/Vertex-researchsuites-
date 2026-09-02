'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { CITATION_STYLES, CitationStyleValue } from '@/lib/citationStyles'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type Construct = {
  id: string
  name: string
  role: 'Scale' | 'Demographic'
  columnIndexes: number[]
  reverseIndexes: number[]
}

export default function PilotStudyColumnsPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [columnHeaders, setColumnHeaders] = useState<string[]>([])
  const [rawData, setRawData] = useState<any[][]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [assignments, setAssignments] = useState<Record<number, string>>({})
  const [constructs, setConstructs] = useState<Construct[]>([])
  const [scaleMin, setScaleMin] = useState(1)
  const [scaleMax, setScaleMax] = useState(5)
  const [newConstructName, setNewConstructName] = useState('')
  const [newConstructRole, setNewConstructRole] = useState<Construct['role']>('Scale')
  const [includeDemographics, setIncludeDemographics] = useState(true)
  const [questionnairesShared, setQuestionnairesShared] = useState<number | ''>('')
  const [responsesReceived, setResponsesReceived] = useState<number | ''>('')
  const [citationStyle, setCitationStyle] = useState<CitationStyleValue | ''>('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('pilot_study_sessions')
        .select('column_headers, raw_data')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please upload your file again.')
        setLoading(false)
        return
      }

      setColumnHeaders(data.column_headers || [])
      setRawData(data.raw_data || [])
      setLoading(false)
    }
    load()
  }, [sessionId])

  const addConstruct = () => {
    const name = newConstructName.trim()
    if (!name) return
    const id = `c_${Date.now()}`
    setConstructs([...constructs, { id, name, role: newConstructRole, columnIndexes: [], reverseIndexes: [] }])
    setNewConstructName('')
  }

  const assignColumn = (colIndex: number, constructId: string) => {
    setAssignments((prev) => ({ ...prev, [colIndex]: constructId }))

    setConstructs((prev) =>
      prev.map((c) => {
        const withoutCol = c.columnIndexes.filter((i) => i !== colIndex)
        if (c.id === constructId) {
          return { ...c, columnIndexes: [...withoutCol, colIndex] }
        }
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
          reverseIndexes: isReversed
            ? c.reverseIndexes.filter((i) => i !== colIndex)
            : [...c.reverseIndexes, colIndex],
        }
      })
    )
  }

  const handleSave = async () => {
    const usedConstructs = constructs.filter((c) => c.columnIndexes.length > 0)

    if (usedConstructs.length === 0) {
      setErrorMsg('Please create at least one construct and assign columns to it.')
      return
    }

    const tooSmallScale = usedConstructs.find((c) => c.role === 'Scale' && c.columnIndexes.length < 2)
    if (tooSmallScale) {
      setErrorMsg(`"${tooSmallScale.name}" needs at least 2 items to calculate reliability.`)
      return
    }

    const hasScaleConstruct = usedConstructs.some((c) => c.role === 'Scale')
    if (!hasScaleConstruct) {
      setErrorMsg('Please add at least one Scale construct (Demographics alone cannot be tested for reliability).')
      return
    }

    const nonNumericConstruct = usedConstructs.find((c) => {
      if (c.role !== 'Scale') return false
      return c.columnIndexes.some((colIndex) =>
        rawData.some((row) => {
          const value = row[colIndex]
          if (value === '' || value === null || value === undefined) return false
          return isNaN(Number(value))
        })
      )
    })
    if (nonNumericConstruct) {
      setErrorMsg(`"${nonNumericConstruct.name}" contains text instead of numbers. Please convert its responses to numeric codes (e.g. "Strongly Agree" -> 5) before continuing.`)
      return
    }

    setSaving(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) { setErrorMsg('Please log in again.'); setSaving(false); return }

    const { data: priceRow } = await supabase.from('feature_pricing').select('price').eq('feature_name', 'pilot_study').single()
    const price = priceRow?.price ?? 0
    if (price > 0) {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', userData.user.id).single()
      const balance = wallet?.balance ?? 0
      if (balance < price) { setErrorMsg('Your balance is not enough, kindly top up.'); setSaving(false); return }
      const { error: deductError } = await supabase.from('wallets').update({ balance: balance - price }).eq('id', userData.user.id)
      if (deductError) { setErrorMsg('Could not process payment. Please try again.'); setSaving(false); return }
      await supabase.from('transactions').insert({ user_id: userData.user.id, type: 'debit', amount: price, status: 'success', description: 'Pilot Study & Reliability Test' })
    }

    const { error } = await supabase
      .from('pilot_study_sessions')
      .update({
        constructs: usedConstructs,
        cleaning_config: { scaleMin, scaleMax },
        include_demographics: includeDemographics,
      questionnaires_shared: questionnairesShared || null,
      responses_received: responsesReceived || null,
        citation_style: citationStyle,
        status: 'mapped',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg('Something went wrong saving your setup. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/pilot-study/${sessionId}/cleaning`)
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
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
        Group Your Items
      </h1>
      <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
        Create your constructs, then assign each question column to one. Tag demographic columns as "Demographic" instead of leaving them unassigned.
      </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Scale used</p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="number"
            value={scaleMin}
            onChange={(e) => setScaleMin(Number(e.target.value))}
            style={{ width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE' }}
          />
          <span style={{ color: '#777777', fontSize: '13px' }}>to</span>
          <input
            type="number"
            value={scaleMax}
            onChange={(e) => setScaleMax(Number(e.target.value))}
            style={{ width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE' }}
          />
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Report settings</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={includeDemographics}
            onChange={(e) => setIncludeDemographics(e.target.checked)}
          />
          <span style={{ color: '#333333', fontSize: '13px' }}>Analyze demographics (uncheck to only collect, not analyze)</span>
        </label>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>APA style</p>
        <select
          value={citationStyle}
          onChange={(e) => setCitationStyle(e.target.value as CitationStyleValue)}
          style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px', color: '#333333' }}
        >
          <option value="">Select citation style</option>
          {CITATION_STYLES.map((style) => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>
      </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
            <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Reliability input (optional)</p>
            <p style={{ color: '#777777', fontSize: '12px', marginBottom: '12px' }}>Add these if you want your response rate calculated in the report.</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <input type="number" placeholder="Questionnaires shared" value={questionnairesShared} onChange={(e) => setQuestionnairesShared(e.target.value === '' ? '' : Number(e.target.value))} style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }} />
              <input type="number" placeholder="Responses received" value={responsesReceived} onChange={(e) => setResponsesReceived(e.target.value === '' ? '' : Number(e.target.value))} style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }} />
            </div>
            {questionnairesShared && responsesReceived ? (
              <p style={{ color: '#333333', fontSize: '12px', fontWeight: 600 }}>Response rate: {((Number(responsesReceived) / Number(questionnairesShared)) * 100).toFixed(1)}%</p>
            ) : null}
          </div>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Your constructs</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="e.g. Exposure"
            value={newConstructName}
            onChange={(e) => setNewConstructName(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }}
          />
          <select
            value={newConstructRole}
            onChange={(e) => setNewConstructRole(e.target.value as Construct['role'])}
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px', color: '#333333' }}
          >
            <option value="Scale">Scale item</option>
            <option value="Demographic">Demographic</option>
          </select>
          <button
            onClick={addConstruct}
            style={{ backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            Add
          </button>
        </div>
        {constructs.map((c) => (
          <span key={c.id} style={{ display: 'inline-block', backgroundColor: '#F9F9F9', border: '1px solid #EEEEEE', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#333333', marginRight: '6px', marginBottom: '6px' }}>
            {c.name} · {c.role} ({c.columnIndexes.length})
          </span>
        ))}
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Assign each column</p>
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
              {assignedConstruct && assignedConstruct.role === 'Scale' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={assignedConstruct.reverseIndexes.includes(idx)}
                    onChange={() => toggleReverse(idx, assignedConstruct.id)}
                  />
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
        {saving ? 'Saving...' : 'Continue to Data Cleaning'}
      </button>
    </div>
  )
}
