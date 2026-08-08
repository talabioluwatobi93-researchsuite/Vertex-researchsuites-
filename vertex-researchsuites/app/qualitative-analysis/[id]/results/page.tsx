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

  useEffect(() => {
    run()
  }, [id])

  async function run() {
    const { data: session } = await supabase
      .from('qualitative_analysis_sessions')
      .select('results')
      .eq('id', id)
      .single()

    if (session?.results) {
      setResults(session.results)
      setStatus('done')
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
      setResults(data.results)
      setStatus('done')
    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong.')
    }
  }

  async function saveToBunker() {
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('bunker_items').insert({
      user_id: userData?.user?.id,
      item_name: 'Qualitative Analysis Report',
      item_type: 'qualitative_analysis_report',
      content_reference: id
    })
    setSaving(false)
    setSaved(true)
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

      <button
        onClick={saveToBunker}
        disabled={saving || saved}
        style={{
          width: '100%', backgroundColor: saved ? '#777777' : '#D4AF37', color: '#333333', border: 'none',
          borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
        }}
      >
        {saved ? 'Saved to Bunker \u2713' : saving ? 'Saving...' : 'Save to Bunker'}
      </button>
    </div>
  )
}
