'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 10px', fontSize: '13px', fontWeight: 400,
  borderBottom: '1px solid #333333', color: '#333333'
}
const tdStyle: React.CSSProperties = { padding: '6px 10px', fontSize: '13px', color: '#333333' }
const tableWrap: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px',
  border: '1px solid #EEEEEE', marginBottom: '24px', overflowX: 'auto'
}
const tableTitle: React.CSSProperties = { fontSize: '13px', fontStyle: 'italic', color: '#333333', marginBottom: '10px' }
const table: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', borderTop: '2px solid #333333', borderBottom: '2px solid #333333'
}

export default function QualResultsPage() {
  const { id } = useParams()
  const [status, setStatus] = useState('Writing your report...')
  const [results, setResults] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(0)

  useEffect(() => {
    run()
  }, [id])

  function beginHold(readyAt: string | null, alreadyRevealed: boolean, resultsData: any) {
    if (!readyAt) {
      setStatus('done')
      return
    }
    const HOLD_MS = 3 * 60 * 1000
    const target = new Date(readyAt).getTime() + HOLD_MS
    const now = Date.now()

    if (now >= target) {
      if (!alreadyRevealed) revealQualResults(resultsData)
      else setStatus('done')
      return
    }

    setStatus('holding')
    setHoldSecondsLeft(Math.ceil((target - now) / 1000))

    const interval = setInterval(() => {
      const remaining = Math.ceil((target - Date.now()) / 1000)
      if (remaining <= 0) {
        clearInterval(interval)
        if (!alreadyRevealed) revealQualResults(resultsData)
        else setStatus('done')
      } else {
        setHoldSecondsLeft(remaining)
      }
    }, 1000)
  }

  async function revealQualResults(resultsData: any) {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user?.id) {
      await supabase.from('bunker_items').insert({
        user_id: userData.user.id,
        item_name: 'Qualitative Analysis - Coded Data',
        item_type: 'qualitative_analysis_dataset',
        content_reference: id,
        is_read: false,
      })
      await supabase.from('bunker_items').insert({
        user_id: userData.user.id,
        item_name: 'Qualitative Analysis - Full Report',
        item_type: 'qualitative_analysis_report',
        content_reference: id,
        is_read: false,
      })
    }
    await supabase
      .from('qualitative_analysis_sessions')
      .update({ results_revealed: true })
      .eq('id', id)
    setStatus('done')
  }

  async function run() {
    const { data: session } = await supabase
      .from('qualitative_analysis_sessions')
      .select('results, results_ready_at, results_revealed')
      .eq('id', id)
      .single()

    if (session?.results) {
      setResults(session.results)
      beginHold(session.results_ready_at, session.results_revealed, session.results)
      return
    }

    try {
      const res = await fetch('/api/qualitative-analysis/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id })
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Report generation failed.')
        return
      }
      const readyAt = new Date().toISOString()
      await supabase
        .from('qualitative_analysis_sessions')
        .update({ results_ready_at: readyAt, results_revealed: false })
        .eq('id', id)
      setResults(data.results)
      beginHold(readyAt, false, data.results)
    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong.')
    }
  }

    if (errorMsg) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 16px' }}>
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '14px', margin: 0 }}>{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (status === 'holding') {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Analyzing your data...</h1>
        <p style={{ color: '#777777', fontSize: '14px', marginBottom: '4px' }}>Please be patient, feel free to leave this page.</p>
        <p style={{ color: '#777777', fontSize: '13px' }}>Ready in {Math.floor(holdSecondsLeft / 60)}:{String(holdSecondsLeft % 60).padStart(2, '0')}</p>
      </div>
    )
  }

  if (status !== 'done') {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>{status}</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#333333', marginBottom: '4px' }}>Results</h1>
      <p style={{ fontSize: '13px', color: '#777777', marginBottom: '24px' }}>
        {results.themeCount} theme{results.themeCount !== 1 ? 's' : ''} &middot; {results.quoteCount} confirmed quote{results.quoteCount !== 1 ? 's' : ''}
      </p>

      {results.frequencyTable && (
        <div style={tableWrap}>
          <p style={tableTitle}>Table 1. Theme Frequency Distribution</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Theme</th>
                <th style={thStyle}>Frequency</th>
                <th style={thStyle}>Percent</th>
              </tr>
            </thead>
            <tbody>
              {results.frequencyTable.map((r: any, i: number) => (
                <tr key={i}>
                  <td style={tdStyle}>{r.theme}</td>
                  <td style={tdStyle}>{r.count}</td>
                  <td style={tdStyle}>{r.percent.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Results Narrative</h2>
        {results.narrative.split('\n').filter(Boolean).map((para: string, i: number) => (
          <p key={i} style={{ fontSize: '13px', color: '#333333', lineHeight: '1.7', marginBottom: '12px' }}>{para}</p>
        ))}
      </div>

      <p style={{ color: '#777777', fontSize: '13px', textAlign: 'center', margin: '0 0 16px 0' }}>
            ✓ Saved to your Bunker
          </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginTop: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#333333', fontWeight: 600, marginBottom: '4px' }}>Want a complete Chapter 5?</p>
        <p style={{ fontSize: '12px', color: '#777777', marginBottom: '14px' }}>Summary, Conclusion, Limitations & Recommendations — built from your findings. Optional, paid add-on.</p>
        <a href={`/qualitative-analysis/${id}/chapter5`} style={{ display: 'inline-block', backgroundColor: '#F9F9F9', color: '#333333', border: '1px solid #D4AF37', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>Add Chapter 5</a>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginTop: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#333333', fontWeight: 600, marginBottom: '4px' }}>Prepare for your defense</p>
        <p style={{ fontSize: '12px', color: '#777777', marginBottom: '14px' }}>Likely questions about your coding and theme choices, built from your actual data. Optional, paid add-on.</p>
        <a href={`/qualitative-analysis/${id}/defense-prep`} style={{ display: 'inline-block', backgroundColor: '#F9F9F9', color: '#333333', border: '1px solid #D4AF37', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>Prepare for Defense</a>
      </div>
    </div>
  )
}
