'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const AUTO_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'Timestamp', regex: /\btimestamp\b/i },
  { label: 'Email', regex: /\be-?mail\b/i },
  { label: 'Submission ID', regex: /\bsubmission\s*id\b/i },
  { label: 'Respondent ID', regex: /\brespondent\s*id\b/i },
  { label: 'ID', regex: /^\s*id\s*$/i },
]

export default function CrossChecksPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [columnHeaders, setColumnHeaders] = useState<string[]>([])
  const [rawData, setRawData] = useState<any[][]>([])

  const [detectedQuestions, setDetectedQuestions] = useState(0)
  const [detectedRespondents, setDetectedRespondents] = useState(0)

  const [expectedQuestions, setExpectedQuestions] = useState('')
  const [expectedSections, setExpectedSections] = useState('')
  const [expectedRespondents, setExpectedRespondents] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const [autoColumns, setAutoColumns] = useState<{ index: number; header: string; label: string; decision: 'keep' | 'remove' }[]>([])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('quantitative_analysis_sessions')
        .select('column_headers, raw_data')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please upload your file again.')
        setLoading(false)
        return
      }

      const headers: string[] = data.column_headers || []
      const rows: any[][] = data.raw_data || []

      setColumnHeaders(headers)
      setRawData(rows)
      setDetectedQuestions(headers.length)
      setDetectedRespondents(rows.length)
      setExpectedQuestions(String(headers.length))
      setExpectedRespondents(String(rows.length))

      const found: any[] = []
      headers.forEach((h, idx) => {
        for (const p of AUTO_PATTERNS) {
          if (p.regex.test(h)) {
            found.push({ index: idx, header: h, label: p.label, decision: 'keep' })
            break
          }
        }
      })
      setAutoColumns(found)
      setLoading(false)
    }
    load()
  }, [sessionId])

  function updateDecision(index: number, decision: 'keep' | 'remove') {
    setAutoColumns((prev) => prev.map((c) => (c.index === index ? { ...c, decision } : c)))
  }

  const handleContinue = async () => {
    if (!expectedSections.trim()) {
      setErrorMsg('Please enter how many sections your questionnaire has.')
      return
    }
    if (!confirmed) {
      setErrorMsg('Please confirm these numbers match your questionnaire before continuing.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    let finalHeaders = [...columnHeaders]
    let finalRows = rawData.map((r) => [...r])

    const toRemove = autoColumns.filter((c) => c.decision === 'remove').map((c) => c.index).sort((a, b) => b - a)
    toRemove.forEach((idx) => {
      finalHeaders.splice(idx, 1)
      finalRows.forEach((row) => row.splice(idx, 1))
    })

    const keptReferenceColumns = autoColumns
      .filter((c) => c.decision === 'keep')
      .map((c) => finalHeaders.indexOf(c.header))

    const crossChecks = {
      detectedQuestions,
      detectedRespondents,
      expectedQuestions: Number(expectedQuestions),
      expectedSections: Number(expectedSections),
      expectedRespondents: Number(expectedRespondents),
    }

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({
        cross_checks: crossChecks,
        column_headers: finalHeaders,
        raw_data: finalRows,
        reference_only_columns: keptReferenceColumns,
        status: 'checked',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg(`Save failed: ${error.message} (code: ${error.code})`)
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/columns`)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #EEEEEE',
    fontSize: '13px',
    color: '#333333',
    marginBottom: '14px',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    color: '#333333',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '6px',
    display: 'block',
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
        Confirm Your Data
      </h1>
      <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
        Step 2 of 10 &mdash; Let's make sure your file matches your questionnaire before we continue.
      </p>

      {autoColumns.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
            We found some auto-generated columns
          </p>
          <p style={{ color: '#777777', fontSize: '12px', marginBottom: '14px' }}>
            These are never included in your statistics either way &mdash; choose whether to keep them for reference or remove them.
          </p>
          {autoColumns.map((c) => (
            <div key={c.index} style={{ padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
              <p style={{ color: '#333333', fontSize: '13px', marginBottom: '8px' }}>
                We found a '{c.header}' column ({c.label}). Do you want to keep it or remove it?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => updateDecision(c.index, 'keep')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: c.decision === 'keep' ? '1px solid #D4AF37' : '1px solid #EEEEEE',
                    backgroundColor: c.decision === 'keep' ? '#FFF8E7' : '#ffffff',
                    color: '#333333', cursor: 'pointer'
                  }}
                >
                  Keep
                </button>
                <button
                  onClick={() => updateDecision(c.index, 'remove')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: c.decision === 'remove' ? '1px solid #D4AF37' : '1px solid #EEEEEE',
                    backgroundColor: c.decision === 'remove' ? '#FFF8E7' : '#ffffff',
                    color: '#333333', cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>What we found in your file</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#777777', fontSize: '13px' }}>Columns detected</span>
          <span style={{ color: '#333333', fontSize: '13px', fontWeight: 700 }}>{detectedQuestions}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#777777', fontSize: '13px' }}>Respondent rows detected</span>
          <span style={{ color: '#333333', fontSize: '13px', fontWeight: 700 }}>{detectedRespondents}</span>
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '14px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Confirm against your questionnaire</p>

        <label style={labelStyle}>Total questions in your questionnaire</label>
        <input style={inputStyle} type="number" value={expectedQuestions} onChange={(e) => setExpectedQuestions(e.target.value)} />

        <label style={labelStyle}>Number of sections</label>
        <input style={inputStyle} type="number" value={expectedSections} onChange={(e) => setExpectedSections(e.target.value)} placeholder="e.g. 4" />

        <label style={labelStyle}>Expected number of respondents</label>
        <input style={inputStyle} type="number" value={expectedRespondents} onChange={(e) => setExpectedRespondents(e.target.value)} />

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: '2px' }} />
          <span style={{ color: '#555555', fontSize: '12px' }}>I confirm these numbers are correct and match my questionnaire.</span>
        </label>
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={saving}
        style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
      >
        {saving ? 'Saving...' : 'Continue'}
      </button>
    </div>
  )
}
