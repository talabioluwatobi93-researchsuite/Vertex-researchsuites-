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
const tdStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: '13px', color: '#333333'
}
const tableWrap: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px',
  border: '1px solid #EEEEEE', marginBottom: '24px', overflowX: 'auto'
}
const tableTitle: React.CSSProperties = {
  fontSize: '13px', fontStyle: 'italic', color: '#333333', marginBottom: '10px'
}
const table: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', borderTop: '2px solid #333333', borderBottom: '2px solid #333333'
}
const noteStyle: React.CSSProperties = {
  fontSize: '11px', color: '#777777', marginTop: '8px', fontStyle: 'italic'
}

export default function ResultsPage() {
  const { id } = useParams()
  const [status, setStatus] = useState('Calculating results...')
  const [results, setResults] = useState<any>(null)
  const [interpretation, setInterpretation] = useState('')
  const [discussion, setDiscussion] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    run()
  }, [id])

  async function run() {
    try {
      setStatus('Calculating results...')
      const calcRes = await fetch('/api/quantitative-analysis/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id })
      })
      const calcData = await calcRes.json()
      if (!calcRes.ok) {
        setErrorMsg(calcData.error || 'Calculation failed.')
        return
      }
      setResults(calcData.results)

      setStatus('Writing interpretation...')
      const interpRes = await fetch('/api/quantitative-analysis/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id })
      })
      const interpData = await interpRes.json()
      if (!interpRes.ok) {
        setErrorMsg(interpData.error || 'Interpretation failed.')
        return
      }
      setInterpretation(interpData.interpretation)
      setDiscussion(interpData.discussion || '')
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
      item_name: 'Quantitative Analysis — Cleaned Dataset',
      item_type: 'quantitative_analysis_dataset',
      content_reference: id
    })
    await supabase.from('bunker_items').insert({
      user_id: userData?.user?.id,
      item_name: 'Quantitative Analysis — Full Report',
      item_type: 'quantitative_analysis_report',
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

  let tableNum = 0
  const nextTable = () => ++tableNum

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#333333', marginBottom: '4px' }}>
        Results
      </h1>
      <p style={{ fontSize: '13px', color: '#777777', marginBottom: '24px' }}>
        N = {results.sampleSize} (excluded {results.excludedRows} row{results.excludedRows !== 1 ? 's' : ''} during cleaning)
      </p>

      {results.descriptives?.length > 0 && (
        <div style={tableWrap}>
          <p style={tableTitle}>Table {nextTable()}. Descriptive Statistics for Study Variables</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Variable</th>
                <th style={thStyle}>N</th>
                <th style={thStyle}>M</th>
                <th style={thStyle}>SD</th>
                <th style={thStyle}>Min</th>
                <th style={thStyle}>Max</th>
              </tr>
            </thead>
            <tbody>
              {results.descriptives.map((d: any, i: number) => (
                <tr key={i}>
                  <td style={tdStyle}>{d.name}</td>
                  <td style={tdStyle}>{d.n}</td>
                  <td style={tdStyle}>{d.mean.toFixed(2)}</td>
                  <td style={tdStyle}>{d.sd.toFixed(2)}</td>
                  <td style={tdStyle}>{d.min.toFixed(2)}</td>
                  <td style={tdStyle}>{d.max.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={noteStyle}>Note. M = Mean, SD = Standard Deviation.</p>
        </div>
      )}

      {results.frequencyTables?.map((f: any, idx: number) => (
        <div key={idx}>
          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. Statistics for {f.name}</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}></th>
                  <th style={thStyle}>N Valid</th>
                  <th style={thStyle}>N Missing</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>{f.name}</td>
                  <td style={tdStyle}>{f.nValid}</td>
                  <td style={tdStyle}>{f.nMissing}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. Frequency Distribution for {f.name}</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}>{f.name}</th>
                  <th style={thStyle}>Frequency</th>
                  <th style={thStyle}>Percent</th>
                  <th style={thStyle}>Valid Percent</th>
                  <th style={thStyle}>Cumulative Percent</th>
                </tr>
              </thead>
              <tbody>
                {f.rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={tdStyle}>{r.label}</td>
                    <td style={tdStyle}>{r.frequency}</td>
                    <td style={tdStyle}>{r.percent.toFixed(2)}</td>
                    <td style={tdStyle}>{r.validPercent.toFixed(2)}</td>
                    <td style={tdStyle}>{r.cumulativePercent.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={noteStyle}>Note. N = {f.nValid + f.nMissing}.</p>
          </div>
        </div>
      ))}

      {results.correlation && (
        <div style={tableWrap}>
          <p style={tableTitle}>Table {nextTable()}. Correlation Matrix Among Study Variables</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Variable</th>
                {results.correlation.labels.map((l: string, i: number) => (
                  <th style={thStyle} key={i}>{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.correlation.matrix.map((row: any, i: number) => (
                <tr key={i}>
                  <td style={tdStyle}>{i + 1}. {row.name}</td>
                  {row.cells.map((cell: any, j: number) => (
                    <td style={tdStyle} key={j}>
                      {cell.r.toFixed(3)}
                      {cell.p !== null && cell.p < 0.05 ? '*' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={noteStyle}>* p &lt; .05</p>
        </div>
      )}

      {results.regression && (
        <>
          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. Variables Entered/Removed</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>Variables Entered</th>
                  <th style={thStyle}>Variables Removed</th>
                  <th style={thStyle}>Method</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>1</td>
                  <td style={tdStyle}>{results.regression.variablesEntered.entered.join(', ')}</td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>{results.regression.variablesEntered.method}</td>
                </tr>
              </tbody>
            </table>
            <p style={noteStyle}>Note. Dependent Variable: {results.regression.dvName}.</p>
          </div>

          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. Model Summary</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>R</th>
                  <th style={thStyle}>R²</th>
                  <th style={thStyle}>Adjusted R²</th>
                  <th style={thStyle}>Std. Error</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>1</td>
                  <td style={tdStyle}>{results.regression.modelSummary.r.toFixed(3)}</td>
                  <td style={tdStyle}>{results.regression.modelSummary.rSquared.toFixed(3)}</td>
                  <td style={tdStyle}>{results.regression.modelSummary.adjRSquared.toFixed(3)}</td>
                  <td style={tdStyle}>{results.regression.modelSummary.stdError.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. ANOVA</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}></th>
                  <th style={thStyle}>Sum of Squares</th>
                  <th style={thStyle}>df</th>
                  <th style={thStyle}>Mean Square</th>
                  <th style={thStyle}>F</th>
                  <th style={thStyle}>Sig.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>Regression</td>
                  <td style={tdStyle}>{results.regression.anova.regression.ss.toFixed(3)}</td>
                  <td style={tdStyle}>{results.regression.anova.regression.df}</td>
                  <td style={tdStyle}>{results.regression.anova.regression.ms.toFixed(3)}</td>
                  <td style={tdStyle}>{results.regression.anova.F.toFixed(3)}</td>
                  <td style={tdStyle}>{results.regression.anova.p.toFixed(3)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Residual</td>
                  <td style={tdStyle}>{results.regression.anova.residual.ss.toFixed(3)}</td>
                  <td style={tdStyle}>{results.regression.anova.residual.df}</td>
                  <td style={tdStyle}>{results.regression.anova.residual.ms.toFixed(3)}</td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}></td>
                </tr>
                <tr>
                  <td style={tdStyle}>Total</td>
                  <td style={tdStyle}>{results.regression.anova.total.ss.toFixed(3)}</td>
                  <td style={tdStyle}>{results.regression.anova.total.df}</td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. Coefficients</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>B</th>
                  <th style={thStyle}>Std. Error</th>
                  <th style={thStyle}>Beta</th>
                  <th style={thStyle}>t</th>
                  <th style={thStyle}>Sig.</th>
                </tr>
              </thead>
              <tbody>
                {results.regression.coefficients.map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={tdStyle}>{c.name}</td>
                    <td style={tdStyle}>{c.B.toFixed(3)}</td>
                    <td style={tdStyle}>{c.SE.toFixed(3)}</td>
                    <td style={tdStyle}>{c.beta !== null ? c.beta.toFixed(3) : '—'}</td>
                    <td style={tdStyle}>{c.t.toFixed(3)}</td>
                    <td style={tdStyle}>{c.p.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={noteStyle}>Note. Dependent Variable: {results.regression.dvName}.</p>
          </div>
        </>
      )}

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Results Interpretation</h2>
        {interpretation.split('\n').filter(Boolean).map((para, i) => (
          <p key={i} style={{ fontSize: '13px', color: '#333333', lineHeight: '1.7', marginBottom: '12px' }}>{para}</p>
        ))}
      </div>

      {discussion && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>General Findings &amp; Discussion</h2>
          {discussion.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ fontSize: '13px', color: '#333333', lineHeight: '1.7', marginBottom: '12px' }}>{para}</p>
          ))}
        </div>
      )}

      <button
        onClick={saveToBunker}
        disabled={saving || saved}
        style={{
          width: '100%', backgroundColor: saved ? '#777777' : '#D4AF37', color: '#333333', border: 'none',
          borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
        }}
      >
        {saved ? 'Saved to Bunker ✓' : saving ? 'Saving...' : 'Save to Bunker'}
      </button>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginTop: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#333333', fontWeight: 600, marginBottom: '4px' }}>Want a complete Chapter 5?</p>
        <p style={{ fontSize: '12px', color: '#777777', marginBottom: '14px' }}>
          Summary, Conclusion, Limitations & Recommendations — built from these results. Optional, paid add-on.
        </p>
        <a href={`/quantitative-analysis/${id}/chapter5`} style={{ display: 'inline-block', backgroundColor: '#F9F9F9', color: '#333333', border: '1px solid #D4AF37', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
          Add Chapter 5
        </a>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginTop: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#333333', fontWeight: 600, marginBottom: '4px' }}>Prepare for your defense</p>
        <p style={{ fontSize: '12px', color: '#777777', marginBottom: '14px' }}>
          Likely questions and answers based on your actual results — not generic textbook Q&A. Optional, paid add-on.
        </p>
        <a href={`/quantitative-analysis/${id}/defense-prep`} style={{ display: 'inline-block', backgroundColor: '#F9F9F9', color: '#333333', border: '1px solid #D4AF37', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
          Prepare for Defense
        </a>
      </div>
    </div>
  )
}
