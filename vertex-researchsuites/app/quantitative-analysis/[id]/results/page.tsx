'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { checkFeatureAccess } from '@/lib/checkFeatureAccess'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LabelList, ReferenceLine } from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const HOLD_MS = 2 * 60 * 1000 // 3 minutes

const thStyle: React.CSSProperties = {
  textAlign: 'center', padding: '6px 10px', fontSize: '13px', fontWeight: 700,
  border: '1px solid #333333', color: '#333333'
}
const tdStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: '13px', color: '#333333', border: '1px solid #333333'
}
const tableWrap: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px',
  border: '1px solid #EEEEEE', marginBottom: '24px', overflowX: 'auto'
}
const tableTitle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 700, color: '#333333', marginBottom: '10px'
}
const table: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', border: '1px solid #333333'
}
const noteStyle: React.CSSProperties = {
  fontSize: '11px', color: '#777777', marginTop: '8px'
}

// SPSS-style number formatting: bounded stats (-1 to 1) drop the leading zero
function formatSpssValue(value: number | null | undefined, decimals: number = 3): string {
  if (value === null || value === undefined || isNaN(value)) return '-'
  const fixed = value.toFixed(decimals)
  if (value > -1 && value < 1) {
    return fixed.replace(/^(-?)0\./, '$1.')
  }
  return fixed
}

function checkInterpretationGate(gateInfo: any) {
  const reasons: string[] = []
  if (!gateInfo?.response_rate_info) reasons.push('Response rate information is missing.')
  if (!gateInfo?.reliability_info) reasons.push('Reliability information is missing.')

  const missingScaleConstructs = (gateInfo?.constructs || []).filter((c: any) => {
    return c.role !== 'Demographic' && !c.presetLabel
  })

  return {
    ready: reasons.length === 0,
    reasons,
    hasMissingScaleLabels: missingScaleConstructs.length > 0,
    missingScaleConstructs
  }
}

export default function ResultsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [status, setStatus] = useState('Calculating results...')
  const [results, setResults] = useState<any>(null)
  const [interpretation, setInterpretation] = useState('')
  const [tableInterpretations, setTableInterpretations] = useState<Record<string, string>>({})
  const [viewMode, setViewMode] = useState<'tables' | 'fullDocument'>('tables')
  const [discussion, setDiscussion] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [gateInfo, setGateInfo] = useState<any>({ constructs: [], response_rate_info: null, reliability_info: null })
  const [reRunInfo, setReRunInfo] = useState<any>({ file_fingerprint: null, raw_data: null, column_headers: null, research_framework: null, parent_session_id: null, user_id: null })
  const [reRunLoading, setReRunLoading] = useState(false)
  const [chartPrefs, setChartPrefs] = useState<{ bar: boolean, pie: boolean }>({ bar: true, pie: true })
  const [tailType, setTailType] = useState<'two' | 'one'>('two')

  useEffect(() => {
    init()
  }, [id])

  async function init() {
    try {
      // 1. Check if this session already has computed results stored
      const { data: session, error: sessionErr } = await supabase
        .from('quantitative_analysis_sessions')
        .select('results_json, interpretation, discussion, results_ready_at, results_revealed, constructs, response_rate_info, reliability_info, file_fingerprint, raw_data, column_headers, research_framework, parent_session_id, user_id, cleaning_config')
        .eq('id', id)
        .single()

      if (sessionErr) {
        setErrorMsg(sessionErr.message)
        return
      }

      let finalResults = session?.results_json
      let finalInterpretation = session?.interpretation
      let finalDiscussion = session?.discussion
      let readyAt = session?.results_ready_at
      setGateInfo({
        constructs: session?.constructs || [],
        response_rate_info: session?.response_rate_info || null,
        reliability_info: session?.reliability_info || null
      })
      const savedChartPrefs = session?.cleaning_config?.chart_preferences
      if (savedChartPrefs) {
        setChartPrefs({ bar: savedChartPrefs.bar ?? true, pie: savedChartPrefs.pie ?? true })
      }
      setReRunInfo({
        file_fingerprint: session?.file_fingerprint || null,
        raw_data: session?.raw_data || null,
        column_headers: session?.column_headers || null,
        research_framework: session?.research_framework || null,
        parent_session_id: session?.parent_session_id || null,
        user_id: session?.user_id || null
      })

      // 2. If not computed yet, compute now and persist to the session row
      if (!finalResults) {
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
        finalResults = calcData.results

        // Gate check: don't auto-run interpretation. Persist calculated
        // results and let the user confirm via the Proceed button below.
        await supabase
          .from('quantitative_analysis_sessions')
          .update({
            results_json: finalResults
          })
          .eq('id', id)

        setResults(finalResults)
        setStatus('awaiting-interpretation')
        return
      }

    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong.')
    }
  }

  function handleDownload() {
    const lines: string[] = []
    lines.push('QUANTITATIVE ANALYSIS RESULTS')
    lines.push('')
    lines.push(`Sample Size: ${results?.sampleSize ?? 'N/A'}`)
    lines.push(`Excluded Rows: ${results?.excludedRows ?? 0}`)
    lines.push('')

    if (results?.descriptives?.length > 0) {
      lines.push('DESCRIPTIVE STATISTICS')
      results.descriptives.forEach((d: any) => {
        lines.push(`${d.variable}: N=${d.n}, Mean=${d.mean}, SD=${d.sd}, Min=${d.min}, Max=${d.max}`)
      })
      lines.push('')
    }

    if (results?.correlation) {
      lines.push('CORRELATION RESULTS')
      lines.push(JSON.stringify(results.correlation, null, 2))
      lines.push('')
    }

    if (results?.regression) {
      lines.push('REGRESSION RESULTS')
      lines.push(JSON.stringify(results.regression, null, 2))
      lines.push('')
    }

    if (interpretation) {
      lines.push('INTERPRETATION')
      lines.push(interpretation)
      lines.push('')
    }

    if (discussion) {
      lines.push('DISCUSSION')
      lines.push(discussion)
      lines.push('')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quantitative-analysis-results-${id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleReRun() {
    setReRunLoading(true)
    setErrorMsg('')
    try {
      const rootId = reRunInfo.parent_session_id || id
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: siblings, error: siblingsErr } = await supabase
        .from('quantitative_analysis_sessions')
        .select('id, created_at')
        .or(`id.eq.${rootId},parent_session_id.eq.${rootId}`)
        .gte('created_at', sevenDaysAgo)

      if (siblingsErr) {
        setErrorMsg('Could not check re-run eligibility. Please try again.')
        setReRunLoading(false)
        return
      }

      const freeReRunsUsed = (siblings || []).length - 1

      // Re-run limit temporarily disabled - unlimited reruns allowed during testing

      const { data: newSession, error: createErr } = await supabase
        .from('quantitative_analysis_sessions')
        .insert({
          user_id: reRunInfo.user_id,
          status: 'uploaded',
          column_headers: reRunInfo.column_headers,
          raw_data: reRunInfo.raw_data,
          research_framework: reRunInfo.research_framework,
          file_fingerprint: reRunInfo.file_fingerprint,
          parent_session_id: rootId
        })
        .select('id')
        .single()

      if (createErr || !newSession) {
        setErrorMsg('Could not start a re-run. Please try again.')
        setReRunLoading(false)
        return
      }

      router.push(`/quantitative-analysis/${newSession.id}/response-rate`)
    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong starting the re-run.')
      setReRunLoading(false)
    }
  }

  async function handleProceed() {
    try {
      setStatus('Analyzing results...')

      const planRes = await fetch('/api/quantitative-analysis/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, phase: 'get_batch_plan' }),
      })
      const planData = await planRes.json()
      if (!planRes.ok) {
        setErrorMsg(planData.error || 'Interpretation failed.')
        return
      }
      const total3aBatches = planData.totalBatches || 0

      let allTables: any[] = []
      for (let i = 0; i < total3aBatches; i++) {
        setStatus(`Analyzing results (${i + 1} of ${total3aBatches})...`)
        const res3a = await fetch('/api/quantitative-analysis/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: id, phase: '3a', batchIndex: i }),
        })
        const data3a = await res3a.json()
        if (!res3a.ok) {
          setErrorMsg(data3a.error || 'Interpretation failed.')
          return
        }
        allTables = allTables.concat(data3a.tables || [])
      }

      const BATCH_SIZE_3B = 4
      const total3bBatches = Math.ceil(allTables.length / BATCH_SIZE_3B)
      let allTableInterpretations: Record<string, string> = {}
      let allHypothesisTesting: any[] = []

      for (let i = 0; i < total3bBatches; i++) {
        setStatus(`Interpreting tables (${i * BATCH_SIZE_3B + 1}-${Math.min((i + 1) * BATCH_SIZE_3B, allTables.length)} of ${allTables.length})...`)
        const res3b = await fetch('/api/quantitative-analysis/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: id, phase: '3b', batchIndex: i, resultTables: allTables }),
        })
        const data3b = await res3b.json()
        if (!res3b.ok) {
          setErrorMsg(data3b.error || 'Interpretation failed.')
          return
        }
        allTableInterpretations = { ...allTableInterpretations, ...(data3b.tableInterpretations || {}) }
        allHypothesisTesting = allHypothesisTesting.concat(data3b.hypothesisTesting || [])
      }

      setStatus('Finalizing interpretation...')
      const resFinal = await fetch('/api/quantitative-analysis/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          phase: 'finalize',
          resultTables: allTables,
          tableInterpretations: allTableInterpretations,
          hypothesisTesting: allHypothesisTesting,
        }),
      })
      const interpData = await resFinal.json()
      if (!resFinal.ok) {
        setErrorMsg(interpData.error || 'Interpretation failed.')
        return
      }

      const finalInterpretation = interpData.interpretation
      const finalDiscussion = interpData.discussion || ''
      const readyAt = new Date().toISOString()

      await supabase
        .from('quantitative_analysis_sessions')
        .update({
          interpretation: finalInterpretation,
          discussion: finalDiscussion,
          results_ready_at: readyAt
        })
        .eq('id', id)

      setInterpretation(finalInterpretation || '')
      setTableInterpretations(interpData.tableInterpretations || {})
      setDiscussion(finalDiscussion || '')

      const readyTime = new Date(readyAt).getTime()
      const revealTime = readyTime + HOLD_MS
      const now = Date.now()

      if (now >= revealTime) {
        await revealNow(results)
      } else {
        setStatus('holding')
        const msLeft = revealTime - now
        setSecondsLeft(Math.ceil(msLeft / 1000))
        const interval = setInterval(() => {
          setSecondsLeft((s) => {
            if (s <= 1) {
              clearInterval(interval)
              revealNow(results)
              return 0
            }
            return s - 1
          })
        }, 1000)
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong.')
    }
  }

  async function revealNow(resultsForBunker: any) {
    const { data: userData } = await supabase.auth.getUser()

    // Only insert bunker items once — guarded by results_revealed flag
    const { data: sessionCheck } = await supabase
      .from('quantitative_analysis_sessions')
      .select('results_revealed')
      .eq('id', id)
      .single()

    if (!sessionCheck?.results_revealed) {
      await supabase.from('bunker_items').insert({
        user_id: userData?.user?.id,
        item_name: 'Quantitative Analysis – Cleaned Dataset',
        item_type: 'quantitative_analysis_dataset',
        content_reference: id,
        is_read: false
      })
      await supabase.from('bunker_items').insert({
        user_id: userData?.user?.id,
        item_name: 'Quantitative Analysis – Full Report',
        item_type: 'quantitative_analysis_report',
        content_reference: id,
        is_read: false
      })
      await supabase
        .from('quantitative_analysis_sessions')
        .update({ results_revealed: true })
        .eq('id', id)
    }

    setStatus('done')
    setRevealed(true)
  }

  if (errorMsg) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 16px' }}>
        <div style={{ backgroundColor: '#FDECEC', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '14px', margin: 0 }}>{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (status === 'holding') {
    const mins = Math.floor(secondsLeft / 60)
    const secs = secondsLeft % 60
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
        <div
          style={{
            width: 56, height: 56, margin: '0 auto 24px', borderRadius: '50%',
            border: '4px solid #EEEEEE', borderTopColor: '#D4AF37',
            animation: 'spin 1s linear infinite'
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '10px' }}>
          Analyzing your data...
        </h2>
        <p style={{ fontSize: '20px', fontWeight: 700, color: '#D4AF37', marginBottom: '10px' }}>
                {mins}:{secs.toString().padStart(2, '0')}
              </p>
              <p style={{ fontSize: '14px', color: '#777777', lineHeight: 1.6, marginBottom: '6px' }}>
          Please kindly be patient — we are analyzing your data to give you the most appropriate result.
        </p>
        <p style={{ fontSize: '14px', color: '#777777', lineHeight: 1.6 }}>
          Feel free to leave this page. As soon as it's ready, it will be saved to your Bunker and you'll be notified.
        </p>
        <p style={{ fontSize: '13px', color: '#D4AF37', fontWeight: 600, marginTop: '20px' }}>
          {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`} remaining
        </p>
      </div>
    )
  }

  
  if ((status !== 'done' && status !== 'awaiting-interpretation') || !results) {
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

        <button
          onClick={handleReRun}
          disabled={reRunLoading}
          style={{
            backgroundColor: '#ffffff',
            color: '#333333',
            border: '1px solid #D4AF37',
            borderRadius: '10px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: reRunLoading ? 'not-allowed' : 'pointer',
            marginBottom: '24px'
          }}
        >
          {reRunLoading ? 'Starting re-run...' : 'Re-run Analysis'}
        </button>

        <button
          onClick={handleDownload}
          style={{
            backgroundColor: '#333333',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '24px',
            marginLeft: '10px'
          }}
        >
          Download Results
        </button>

          {results.frequencyTables?.map((f: any, idx: number) => (
            <div key={idx} style={tableWrap}>
                <p style={tableTitle}>Table {nextTable()}. Frequency Distribution for {f.name}</p>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={thStyle} colSpan={5}>{f.name}</th>
                    </tr>
                    <tr>
                      <th style={thStyle}></th>
                      <th style={thStyle}></th>
                      <th style={thStyle}>Frequency</th>
                      <th style={thStyle}>Percent</th>
                      <th style={thStyle}>Valid Percent</th>
                      <th style={thStyle}>Cumulative Percent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.rows.map((r: any, i: number) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#F7F7F5' : 'transparent' }}>
                        {i === 0 && (
                          <td style={tdStyle} rowSpan={f.rows.length}>Valid</td>
                        )}
                        <td style={tdStyle}>{r.label}</td>
                        <td style={tdStyle}>{r.frequency}</td>
                        <td style={tdStyle}>{r.percent.toFixed(2)}</td>
                        <td style={tdStyle}>{r.validPercent.toFixed(2)}</td>
                        <td style={tdStyle}>{r.cumulativePercent.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={tdStyle} colSpan={2}>Total</td>
                      <td style={tdStyle}>{f.nValid}</td>
                      <td style={tdStyle}>100.0</td>
                      <td style={tdStyle}>100.0</td>
                      <td style={tdStyle}></td>
                    </tr>
                  </tbody>
                </table>
                <p style={noteStyle}>Note. N = {f.nValid + f.nMissing} ({f.nValid} valid, {f.nMissing} missing).</p>
              {chartPrefs.pie && (
                <div style={{ width: '100%', height: 260, marginTop: '16px' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={f.rows}
                        dataKey="frequency"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(entry: any) => entry.label}
                      >
                        {f.rows.map((_r: any, ri: number) => (
                          <Cell key={`cell-${ri}`} fill={['#D4AF37', '#2E86AB', '#A23B72', '#3B8C6E', '#E07A3E', '#6A4C93'][ri % 6]} stroke="#000000" strokeWidth={1} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}

      {results.itemDescriptives?.map((c: any, ci: number) => (
        <div key={ci} style={tableWrap}>
          <p style={tableTitle}>Table {nextTable()}. Item Descriptive Statistics for {c.constructName}</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Items</th>
                {Array.from({ length: c.scaleMax - c.scaleMin + 1 }, (_, i) => c.scaleMin + i).map((p: number) => (
                  <th key={p} style={thStyle}>{p}</th>
                ))}
                <th style={thStyle}>M</th>
                <th style={thStyle}>SD</th>
                <th style={thStyle}>Overall %</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it: any, ii: number) => (
                <tr key={ii} style={{ backgroundColor: ii % 2 === 0 ? '#F7F7F5' : 'transparent' }}>
                  <td style={tdStyle}>{it.label}</td>
                  {Array.from({ length: c.scaleMax - c.scaleMin + 1 }, (_, i) => c.scaleMin + i).map((p: number) => (
                    <td key={p} style={tdStyle}>{it.pointPercents[p]?.toFixed(1)}%</td>
                  ))}
                  <td style={tdStyle}>{it.mean !== null ? it.mean.toFixed(2) : '—'}</td>
                  <td style={tdStyle}>{it.sd !== null ? it.sd.toFixed(2) : '—'}</td>
                  <td style={tdStyle}>{it.overallPercent !== null ? `${it.overallPercent.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid #333333' }}>
                  <td style={tdStyle}>Total / Composite</td>
                  {Array.from({ length: c.scaleMax - c.scaleMin + 1 }, (_, i) => c.scaleMin + i).map((p: number) => (
                    <td key={p} style={tdStyle}></td>
                  ))}
                  <td style={tdStyle}>{c.totalMean !== null ? c.totalMean.toFixed(2) : '-'}</td>
                  <td style={tdStyle}>{c.totalSD !== null ? c.totalSD.toFixed(2) : '-'}</td>
                  <td style={tdStyle}>{c.totalOverallPercent !== null ? `${c.totalOverallPercent.toFixed(1)}%` : '-'}</td>
                </tr>
            </tbody>
          </table>
          <p style={noteStyle}>Scale: {c.scaleMin} = lowest point, {c.scaleMax} = highest point.</p>
          {chartPrefs.bar && c.items && c.items.length > 0 && (
            <div style={{ width: '100%', height: Math.max(260, c.items.length * 50), marginTop: '12px' }}>
              <ResponsiveContainer>
                <BarChart data={c.items} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="label" stroke="#333333" tick={{ fill: '#333333', fontSize: 11 }} />
                  <YAxis domain={[c.scaleMin, c.scaleMax]} stroke="#333333" tick={{ fill: '#333333', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="mean" fill="#D4AF37" stroke="#000000" strokeWidth={1}>
                    <LabelList dataKey="mean" position="top" formatter={(v: any) => Number(v).toFixed(2)} />
                  </Bar>
                  {c.totalMean !== null && (
                    <ReferenceLine y={c.totalMean} stroke="#888" strokeDasharray="4 4" label={{ value: 'Construct Mean: ' + c.totalMean.toFixed(2), position: 'insideTopRight', fontSize: 11 }} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ))}

          {status === 'awaiting-interpretation' && (() => {
      const gate = checkInterpretationGate(gateInfo)
      return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#333333', marginBottom: '4px' }}>
          Results
        </h1>
        <p style={{ fontSize: '13px', color: '#777777', marginBottom: '24px' }}>
          Your data has been calculated. Review below, then proceed to generate the full interpretation.
        </p>

        {gate.hasMissingScaleLabels && (
          <div style={{ backgroundColor: '#FFF8E7', borderRadius: '12px', padding: '14px', marginBottom: '16px', border: '1px solid #D4AF37' }}>
            <p style={{ color: '#333333', fontSize: '13px', margin: 0 }}>
              Some scales are missing meaning labels. Interpretation will note this rather than guess.
            </p>
          </div>
        )}

        {!gate.ready && (
          <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <p style={{ color: '#C0392B', fontSize: '13px', margin: 0, fontWeight: 600 }}>
              Cannot proceed to interpretation yet:
            </p>
            <ul style={{ color: '#C0392B', fontSize: '13px', margin: '4px 0 0 18px', padding: 0 }}>
              {gate.reasons.map((r: string, idx: number) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleProceed}
          disabled={!gate.ready}
          style={{
            width: '100%',
            backgroundColor: gate.ready ? '#D4AF37' : '#EEEEEE',
            color: gate.ready ? '#333333' : '#999999',
            border: 'none',
            borderRadius: '10px',
            padding: '14px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: gate.ready ? 'pointer' : 'not-allowed'
          }}
        >
          Proceed to Full Document Interpretation
        </button>
      </div>
      )
    })()}

{interpretation && Object.keys(tableInterpretations).length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            onClick={() => setViewMode(viewMode === 'tables' ? 'fullDocument' : 'tables')}
            style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #D4AF37', backgroundColor: viewMode === 'fullDocument' ? '#D4AF37' : '#ffffff', color: viewMode === 'fullDocument' ? '#ffffff' : '#333333', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            {viewMode === 'fullDocument' ? 'View Tables Only' : 'Get Full Document'}
          </button>
        </div>
      )}
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
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#F7F7F5' : 'transparent' }}>
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

      {results.correlation && (
        <div style={tableWrap}>
          <p style={tableTitle}>Table {nextTable()}. Pearson Correlations Among Study Variables (Default)</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Variable</th>
                <th style={thStyle}></th>
                {results.correlation.labels.map((l: string, i: number) => (
                  <th style={thStyle} key={i}>{i + 1}. {l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.correlation.matrix.flatMap((row: any, i: number) => ([
                <tr key={`${i}-r`}>
                  <td style={tdStyle} rowSpan={3}>{i + 1}. {row.name}</td>
                  <td style={tdStyle}>Pearson Correlation</td>
                  {row.cells.map((cell: any, j: number) => (
                    <td style={tdStyle} key={j}>
                      {formatSpssValue(cell.r, 3)}
                      {cell.p !== null && (tailType === 'one' ? cell.pOneTailed : cell.p) < 0.05 ? '*' : ''}
                    </td>
                  ))}
                </tr>,
                <tr key={`${i}-p`}>
                  <td style={tdStyle}>Sig. ({tailType === 'one' ? '1-tailed' : '2-tailed'})</td>
                  {row.cells.map((cell: any, j: number) => (
                    <td style={tdStyle} key={j}>
                      {cell.p === null ? '' : (tailType === 'one' ? cell.pOneTailed : cell.p).toFixed(3)}
                    </td>
                  ))}
                </tr>,
                <tr key={`${i}-n`}>
                  <td style={tdStyle}>N</td>
                  {row.cells.map((cell: any, j: number) => (
                    <td style={tdStyle} key={j}>{cell.n}</td>
                  ))}
                </tr>
              ]))}
            </tbody>
          </table>
          <p style={noteStyle}>* p &lt; .05. Pearson is the default correlation reported.</p>
        </div>
      )}

      {results.correlation && (
        <div style={{ backgroundColor: '#FFF8E7', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid #D4AF37' }}>
          <p style={{ color: '#333333', fontSize: '13px', margin: '0 0 10px 0' }}>{results.correlation?.spearmanMatrix && results.correlation.spearmanMatrix.length > 0 && results.correlation.recommendation}</p>
          <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginRight: '8px' }}>Significance test:</label>
          <select
            value={tailType}
            onChange={(e) => setTailType(e.target.value as 'two' | 'one')}
            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #EEEEEE', fontSize: '12px' }}
          >
            <option value="two">Two-tailed (default)</option>
            <option value="one">One-tailed (only if hypothesis is directional)</option>
          </select>
        </div>
      )}

      {results.correlation?.spearmanMatrix && (
        <div style={tableWrap}>
          <p style={tableTitle}>Table {nextTable()}. Spearman's Rank Correlations Among Study Variables (Supplementary)</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Variable</th>
                <th style={thStyle}></th>
                {results.correlation.labels.map((l: string, i: number) => (
                  <th style={thStyle} key={i}>{i + 1}. {l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.correlation.spearmanMatrix.flatMap((row: any, i: number) => ([
                <tr key={`${i}-r`}>
                  <td style={tdStyle} rowSpan={3}>{i + 1}. {row.name}</td>
                  <td style={tdStyle}>Spearman's rho</td>
                  {row.cells.map((cell: any, j: number) => (
                    <td style={tdStyle} key={j}>
                      {formatSpssValue(cell.r, 3)}
                      {cell.p !== null && cell.p < 0.05 ? '*' : ''}
                    </td>
                  ))}
                </tr>,
                <tr key={`${i}-p`}>
                  <td style={tdStyle}>Sig. (2-tailed)</td>
                  {row.cells.map((cell: any, j: number) => (
                    <td style={tdStyle} key={j}>
                      {cell.p === null ? '' : formatSpssValue(cell.p, 3)}
                    </td>
                  ))}
                </tr>,
                <tr key={`${i}-n`}>
                  <td style={tdStyle}>N</td>
                  {row.cells.map((cell: any, j: number) => (
                    <td style={tdStyle} key={j}>{cell.n}</td>
                  ))}
                </tr>
              ]))}
            </tbody>
          </table>
          <p style={noteStyle}>* p &lt; .05. Spearman reported alongside Pearson (the default) for robustness.</p>
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
                <p style={noteStyle}>a. Dependent Variable: {results.regression.dvName}.</p>
                <p style={noteStyle}>b. All requested variables entered.</p>
          </div>

          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. Model Summary</p>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={thStyle} rowSpan={2}>Model</th>
                      <th style={thStyle} rowSpan={2}>R</th>
                      <th style={thStyle} rowSpan={2}>R²</th>
                      <th style={thStyle} rowSpan={2}>Adjusted R²</th>
                      <th style={thStyle} rowSpan={2}>Std. Error</th>
                      <th style={thStyle} colSpan={5}>Change Statistics</th>
                    </tr>
                    <tr>
                      <th style={thStyle}>R² Change</th>
                      <th style={thStyle}>F Change</th>
                      <th style={thStyle}>df1</th>
                      <th style={thStyle}>df2</th>
                      <th style={thStyle}>Sig. F Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={tdStyle}>1</td>
                      <td style={tdStyle}>{formatSpssValue(results.regression.modelSummary.r, 3)}</td>
                      <td style={tdStyle}>{results.regression.modelSummary.rSquared.toFixed(3)}</td>
                      <td style={tdStyle}>{results.regression.modelSummary.adjRSquared.toFixed(3)}</td>
                      <td style={tdStyle}>{results.regression.modelSummary.stdError.toFixed(3)}</td>
                      <td style={tdStyle}>{results.regression.modelSummary.rSquaredChange?.toFixed(3) ?? '-'}</td>
                      <td style={tdStyle}>{results.regression.modelSummary.fChange?.toFixed(3) ?? '-'}</td>
                      <td style={tdStyle}>{results.regression.modelSummary.df1 ?? '-'}</td>
                      <td style={tdStyle}>{results.regression.modelSummary.df2 ?? '-'}</td>
                      <td style={tdStyle}>{results.regression.modelSummary.sigFChange?.toFixed(3) ?? '-'}</td>
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
                  <td style={tdStyle}>{formatSpssValue(results.regression.anova.p, 3)}</td>
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
                <p style={noteStyle}>a. Dependent Variable: {results.regression.dvName}.</p>
                <p style={noteStyle}>b. Predictors: (Constant), {results.regression.variablesEntered.entered.join(', ')}.</p>
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
                    <td style={tdStyle}>{c.beta !== null ? formatSpssValue(c.beta, 3) : '—'}</td>
                    <td style={tdStyle}>{c.t.toFixed(3)}</td>
                    <td style={tdStyle}>{formatSpssValue(c.p, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={noteStyle}>Note. Dependent Variable: {results.regression.dvName}.</p>
          </div>
        </>
      )}


      {results.ttest && (
        <>
          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. Group Statistics</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}>{results.ttest.groupVariableName}</th>
                  <th style={thStyle}>N</th>
                  <th style={thStyle}>Mean</th>
                  <th style={thStyle}>Std. Deviation</th>
                  <th style={thStyle}>Std. Error Mean</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>{results.ttest.group1Label}</td>
                  <td style={tdStyle}>{results.ttest.group1.n}</td>
                  <td style={tdStyle}>{results.ttest.group1.mean.toFixed(2)}</td>
                  <td style={tdStyle}>{results.ttest.group1.sd.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.group1.sem.toFixed(3)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>{results.ttest.group2Label}</td>
                  <td style={tdStyle}>{results.ttest.group2.n}</td>
                  <td style={tdStyle}>{results.ttest.group2.mean.toFixed(2)}</td>
                  <td style={tdStyle}>{results.ttest.group2.sd.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.group2.sem.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
            <p style={noteStyle}>Note. Dependent Variable: {results.ttest.outcomeVariableName}.</p>
          </div>

          <div style={tableWrap}>
            <p style={tableTitle}>Table {nextTable()}. Independent Samples Test</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}></th>
                  <th style={thStyle}>Levene's F</th>
                  <th style={thStyle}>Levene's Sig.</th>
                  <th style={thStyle}>t</th>
                  <th style={thStyle}>df</th>
                  <th style={thStyle}>Sig. (2-tailed)</th>
                  <th style={thStyle}>Mean Diff.</th>
                  <th style={thStyle}>Std. Error Diff.</th>
                  <th style={thStyle}>95% CI Lower</th>
                  <th style={thStyle}>95% CI Upper</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>Equal variances assumed</td>
                  <td style={tdStyle}>{results.ttest.levene.f.toFixed(3)}</td>
                  <td style={tdStyle}>{formatSpssValue(results.ttest.levene.p, 3)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.t.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.df.toFixed(0)}</td>
                  <td style={tdStyle}>{formatSpssValue(results.ttest.equalVariances.p, 3)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.meanDiff.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.seDiff.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.ciLower.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.ciUpper.toFixed(3)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Equal variances not assumed</td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}>{results.ttest.unequalVariances.t.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.unequalVariances.df.toFixed(3)}</td>
                  <td style={tdStyle}>{formatSpssValue(results.ttest.unequalVariances.p, 3)}</td>
                  <td style={tdStyle}>{results.ttest.unequalVariances.meanDiff.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.unequalVariances.seDiff.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.unequalVariances.ciLower.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.unequalVariances.ciUpper.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
            <p style={noteStyle}>Note. If Levene's Sig. &lt; .05, use the "Equal variances not assumed" row.</p>
          </div>
        </>
      )}
{results.anova && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
            <p style={tableTitle}>Table {nextTable()}. Descriptive Statistics for {results.anova.outcomeVariableName} by {results.anova.groupVariableName}</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}>{results.anova.groupVariableName}</th>
                  <th style={thStyle}>N</th>
                  <th style={thStyle}>Mean</th>
                  <th style={thStyle}>SD</th>
                  <th style={thStyle}>SEM</th>
                  <th style={thStyle}>95% CI Lower</th>
                  <th style={thStyle}>95% CI Upper</th>
                  <th style={thStyle}>Min</th>
                  <th style={thStyle}>Max</th>
                </tr>
              </thead>
              <tbody>
                {results.anova.groupStats.map((g: any, i: number) => (
                  <tr key={i}>
                    <td style={tdStyle}>{g.label}</td>
                    <td style={tdStyle}>{g.n}</td>
                    <td style={tdStyle}>{g.mean.toFixed(2)}</td>
                    <td style={tdStyle}>{g.sd.toFixed(2)}</td>
                    <td style={tdStyle}>{g.sem.toFixed(2)}</td>
                    <td style={tdStyle}>{g.ciLower.toFixed(2)}</td>
                    <td style={tdStyle}>{g.ciUpper.toFixed(2)}</td>
                    <td style={tdStyle}>{g.min.toFixed(2)}</td>
                    <td style={tdStyle}>{g.max.toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={tdStyle}>Total</td>
                  <td style={tdStyle}>{results.anova.n}</td>
                  <td style={tdStyle}>{results.anova.grandMean.toFixed(2)}</td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>—</td>
                </tr>
              </tbody>
            </table>

            <p style={tableTitle}>Table {nextTable()}. One-Way ANOVA: {results.anova.outcomeVariableName} by {results.anova.groupVariableName}</p>
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
                  <td style={tdStyle}>Between Groups</td>
                  <td style={tdStyle}>{results.anova.ssBetween.toFixed(3)}</td>
                  <td style={tdStyle}>{results.anova.dfBetween}</td>
                  <td style={tdStyle}>{results.anova.msBetween.toFixed(3)}</td>
                  <td style={tdStyle}>{results.anova.F.toFixed(3)}</td>
                  <td style={tdStyle}>{formatSpssValue(results.anova.p, 3)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Within Groups</td>
                  <td style={tdStyle}>{results.anova.ssWithin.toFixed(3)}</td>
                  <td style={tdStyle}>{results.anova.dfWithin}</td>
                  <td style={tdStyle}>{results.anova.msWithin.toFixed(3)}</td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}></td>
                </tr>
                <tr>
                  <td style={tdStyle}>Total</td>
                  <td style={tdStyle}>{results.anova.ssTotal.toFixed(3)}</td>
                  <td style={tdStyle}>{results.anova.dfBetween + results.anova.dfWithin}</td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}></td>
                </tr>
              </tbody>
            </table>

            <p style={tableTitle}>Table {nextTable()}. Post Hoc Tests — Tukey HSD Multiple Comparisons</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}>(I) Group</th>
                  <th style={thStyle}>(J) Group</th>
                  <th style={thStyle}>Mean Diff. (I-J)</th>
                  <th style={thStyle}>Std. Error</th>
                  <th style={thStyle}>Sig.</th>
                  <th style={thStyle}>95% CI Lower</th>
                  <th style={thStyle}>95% CI Upper</th>
                </tr>
              </thead>
              <tbody>
                {results.anova.tukey.map((t: any, i: number) => (
                  <tr key={i}>
                    <td style={tdStyle}>{t.groupA}</td>
                    <td style={tdStyle}>{t.groupB}</td>
                    <td style={tdStyle}>{t.meanDiff.toFixed(3)}</td>
                    <td style={tdStyle}>{t.seDiff.toFixed(3)}</td>
                    <td style={tdStyle}>{formatSpssValue(t.p, 3)}</td>
                    <td style={tdStyle}>{t.ciLower.toFixed(3)}</td>
                    <td style={tdStyle}>{t.ciUpper.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={noteStyle}>Note. Post hoc comparisons use the Tukey HSD test. The mean difference is significant at the .05 level when Sig. is less than .05.</p>
          </div>
        )}
        
{results.chisquare && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
            <p style={tableTitle}>Table {nextTable()}. {results.chisquare.rowVariableName} * {results.chisquare.colVariableName} Crosstabulation</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}>{results.chisquare.rowVariableName}</th>
                  {results.chisquare.colLabels.map((label: string, j: number) => (
                    <th key={j} style={thStyle}>{label}</th>
                  ))}
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>
              <tbody>
                {results.chisquare.crosstab.map((row: any, i: number) => (
                  <tr key={i}>
                    <td style={tdStyle}>{row.label}</td>
                    {row.observed.map((o: number, j: number) => (
                      <td key={j} style={tdStyle}>{o} <span style={{ color: '#777777' }}>({row.expected[j].toFixed(1)})</span></td>
                    ))}
                    <td style={tdStyle}>{row.rowTotal}</td>
                  </tr>
                ))}
                <tr>
                  <td style={tdStyle}>Total</td>
                  {results.chisquare.colTotals.map((t: number, j: number) => (
                    <td key={j} style={tdStyle}>{t}</td>
                  ))}
                  <td style={tdStyle}>{results.chisquare.grandTotal}</td>
                </tr>
              </tbody>
            </table>
            <p style={noteStyle}>Note. Values shown are Count, with Expected Count in parentheses.</p>

            <p style={tableTitle}>Table {nextTable()}. Chi-Square Tests</p>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thStyle}></th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>df</th>
                  <th style={thStyle}>Asymp. Sig. (2-sided)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>Pearson Chi-Square</td>
                  <td style={tdStyle}>{results.chisquare.pearsonChiSq.toFixed(3)}</td>
                  <td style={tdStyle}>{results.chisquare.df}</td>
                  <td style={tdStyle}>{results.chisquare.pearsonP.toFixed(3)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Likelihood Ratio</td>
                  <td style={tdStyle}>{results.chisquare.likelihoodRatio.toFixed(3)}</td>
                  <td style={tdStyle}>{results.chisquare.df}</td>
                  <td style={tdStyle}>{results.chisquare.likelihoodP.toFixed(3)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Linear-by-Linear Association</td>
                  <td style={tdStyle}>{results.chisquare.linearByLinear.toFixed(3)}</td>
                  <td style={tdStyle}>1</td>
                  <td style={tdStyle}>{results.chisquare.linearP.toFixed(3)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>N of Valid Cases</td>
                  <td style={tdStyle}>{results.chisquare.grandTotal}</td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}></td>
                </tr>
              </tbody>
            </table>
            <p style={noteStyle}>
              Note. {results.chisquare.cellsUnderFive} cells ({results.chisquare.pctCellsUnderFive.toFixed(1)}%) have expected count less than 5.
              The minimum expected count is {results.chisquare.minExpected.toFixed(2)}. Cramér's V = {results.chisquare.cramersV.toFixed(3)}.
            </p>
          </div>
        )}
        
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #D4AF37', marginBottom: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#333333', fontWeight: 600, margin: 0 }}>
      {results.pairedTtest && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Paired Samples Test</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>N</th>
                <th style={thStyle}>Mean</th>
                <th style={thStyle}>Std. Deviation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Measurement 1</td>
                <td style={tdStyle}>{results.pairedTtest.n}</td>
                <td style={tdStyle}>{results.pairedTtest.before.mean.toFixed(2)}</td>
                <td style={tdStyle}>{results.pairedTtest.before.sd.toFixed(2)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>Measurement 2</td>
                <td style={tdStyle}>{results.pairedTtest.n}</td>
                <td style={tdStyle}>{results.pairedTtest.after.mean.toFixed(2)}</td>
                <td style={tdStyle}>{results.pairedTtest.after.sd.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p style={noteStyle}>Note. Paired-samples comparison of the same participants across two measurements.</p>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[16] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[16]}
            </div>
          )}
        </div>
      )}

      {results.pairedTtest && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Paired Samples Test Statistics</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Mean Diff.</th>
                <th style={thStyle}>Std. Deviation</th>
                <th style={thStyle}>Std. Error Mean</th>
                <th style={thStyle}>95% CI Lower</th>
                <th style={thStyle}>95% CI Upper</th>
                <th style={thStyle}>t</th>
                <th style={thStyle}>df</th>
                <th style={thStyle}>Sig. (2-tailed)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{results.pairedTtest.meanDiff.toFixed(3)}</td>
                <td style={tdStyle}>{results.pairedTtest.sdDiff.toFixed(3)}</td>
                <td style={tdStyle}>{results.pairedTtest.semDiff.toFixed(3)}</td>
                <td style={tdStyle}>{results.pairedTtest.ciLower.toFixed(3)}</td>
                <td style={tdStyle}>{results.pairedTtest.ciUpper.toFixed(3)}</td>
                <td style={tdStyle}>{results.pairedTtest.t.toFixed(3)}</td>
                <td style={tdStyle}>{results.pairedTtest.df}</td>
                <td style={tdStyle}>{formatSpssValue(results.pairedTtest.p, 3)}</td>
              </tr>
            </tbody>
          </table>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[17] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[17]}
            </div>
          )}
        </div>
      )}

      {results.anovaTwoWay && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Tests of Between-Subjects Effects</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Sum of Squares</th>
                <th style={thStyle}>df</th>
                <th style={thStyle}>Mean Square</th>
                <th style={thStyle}>F</th>
                <th style={thStyle}>Sig.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Factor A</td>
                <td style={tdStyle}>{results.anovaTwoWay.factorA.ss.toFixed(3)}</td>
                <td style={tdStyle}>{results.anovaTwoWay.factorA.df}</td>
                <td style={tdStyle}>{results.anovaTwoWay.factorA.ms.toFixed(3)}</td>
                <td style={tdStyle}>{results.anovaTwoWay.factorA.f.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.anovaTwoWay.factorA.p, 3)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>Factor B</td>
                <td style={tdStyle}>{results.anovaTwoWay.factorB.ss.toFixed(3)}</td>
                <td style={tdStyle}>{results.anovaTwoWay.factorB.df}</td>
                <td style={tdStyle}>{results.anovaTwoWay.factorB.ms.toFixed(3)}</td>
                <td style={tdStyle}>{results.anovaTwoWay.factorB.f.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.anovaTwoWay.factorB.p, 3)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>Factor A * Factor B</td>
                <td style={tdStyle}>{results.anovaTwoWay.interaction.ss.toFixed(3)}</td>
                <td style={tdStyle}>{results.anovaTwoWay.interaction.df}</td>
                <td style={tdStyle}>{results.anovaTwoWay.interaction.ms.toFixed(3)}</td>
                <td style={tdStyle}>{results.anovaTwoWay.interaction.f.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.anovaTwoWay.interaction.p, 3)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>Error</td>
                <td style={tdStyle}>{results.anovaTwoWay.error.ss.toFixed(3)}</td>
                <td style={tdStyle}>{results.anovaTwoWay.error.df}</td>
                <td style={tdStyle}>{results.anovaTwoWay.error.ms.toFixed(3)}</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
              </tr>
              <tr>
                <td style={tdStyle}>Total</td>
                <td style={tdStyle}>{results.anovaTwoWay.total.ss.toFixed(3)}</td>
                <td style={tdStyle}>{results.anovaTwoWay.total.df}</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
              </tr>
            </tbody>
          </table>
          <p style={noteStyle}>Note. Two-way ANOVA testing main effects of Factor A and Factor B, and their interaction, on the outcome variable.</p>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[18] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[18]}
            </div>
          )}
        </div>
      )}

      {results.logisticRegression && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Model Summary</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>N</th>
                <th style={thStyle}>-2 Log Likelihood</th>
                <th style={thStyle}>McFadden R²</th>
                <th style={thStyle}>Chi-Square</th>
                <th style={thStyle}>df</th>
                <th style={thStyle}>Sig.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{results.logisticRegression.n}</td>
                <td style={tdStyle}>{(-2 * results.logisticRegression.logLikelihood).toFixed(3)}</td>
                <td style={tdStyle}>{results.logisticRegression.mcFaddenR2.toFixed(3)}</td>
                <td style={tdStyle}>{results.logisticRegression.chiSq.toFixed(3)}</td>
                <td style={tdStyle}>{results.logisticRegression.df}</td>
                <td style={tdStyle}>{formatSpssValue(results.logisticRegression.p, 3)}</td>
              </tr>
            </tbody>
          </table>
          <p style={noteStyle}>Note. Model {results.logisticRegression.converged ? 'converged' : 'did not converge'} after {results.logisticRegression.iterations} iteration(s).</p>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[19] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[19]}
            </div>
          )}
        </div>
      )}

      {results.logisticRegression && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Variables in the Equation</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Variable</th>
                <th style={thStyle}>B</th>
                <th style={thStyle}>S.E.</th>
                <th style={thStyle}>z</th>
                <th style={thStyle}>Sig.</th>
                <th style={thStyle}>Exp(B)</th>
              </tr>
            </thead>
            <tbody>
              {results.logisticRegression.coefficients.map((c: any, i: number) => (
                <tr key={i}>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.B.toFixed(3)}</td>
                  <td style={tdStyle}>{c.SE.toFixed(3)}</td>
                  <td style={tdStyle}>{c.z.toFixed(3)}</td>
                  <td style={tdStyle}>{formatSpssValue(c.p, 3)}</td>
                  <td style={tdStyle}>{c.oddsRatio.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={noteStyle}>Note. Dependent Variable is binary (0/1). Exp(B) represents the odds ratio for each predictor.</p>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[20] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[20]}
            </div>
          )}
        </div>
      )}

      {results.wilcoxon && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Wilcoxon Signed-Rank Test</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>N</th>
                <th style={thStyle}>N Excluded (Ties=0)</th>
                <th style={thStyle}>W+</th>
                <th style={thStyle}>W-</th>
                <th style={thStyle}>W</th>
                <th style={thStyle}>Mean W</th>
                <th style={thStyle}>SD W</th>
                <th style={thStyle}>Z</th>
                <th style={thStyle}>Sig.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{results.wilcoxon.n}</td>
                <td style={tdStyle}>{results.wilcoxon.nExcludedZero}</td>
                <td style={tdStyle}>{results.wilcoxon.wPlus.toFixed(1)}</td>
                <td style={tdStyle}>{results.wilcoxon.wMinus.toFixed(1)}</td>
                <td style={tdStyle}>{results.wilcoxon.w.toFixed(1)}</td>
                <td style={tdStyle}>{results.wilcoxon.meanW.toFixed(2)}</td>
                <td style={tdStyle}>{results.wilcoxon.sigmaW.toFixed(2)}</td>
                <td style={tdStyle}>{results.wilcoxon.z.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.wilcoxon.p, 3)}</td>
              </tr>
            </tbody>
          </table>
          <p style={noteStyle}>Note. Wilcoxon Signed-Rank Test for two related samples.</p>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[21] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[21]}
            </div>
          )}
        </div>
      )}

      {results.mannWhitney && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Mann-Whitney U Test Ranks</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Group</th>
                <th style={thStyle}>N</th>
                <th style={thStyle}>Median</th>
                <th style={thStyle}>Rank Sum</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{results.mannWhitney.group1Label}</td>
                <td style={tdStyle}>{results.mannWhitney.group1.n}</td>
                <td style={tdStyle}>{results.mannWhitney.group1.median.toFixed(2)}</td>
                <td style={tdStyle}>{results.mannWhitney.group1.rankSum.toFixed(1)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>{results.mannWhitney.group2Label}</td>
                <td style={tdStyle}>{results.mannWhitney.group2.n}</td>
                <td style={tdStyle}>{results.mannWhitney.group2.median.toFixed(2)}</td>
                <td style={tdStyle}>{results.mannWhitney.group2.rankSum.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[22] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[22]}
            </div>
          )}
        </div>
      )}

      {results.mannWhitney && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Mann-Whitney U Test Statistics</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>U</th>
                <th style={thStyle}>Z</th>
                <th style={thStyle}>Sig.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{results.mannWhitney.u.toFixed(1)}</td>
                <td style={tdStyle}>{results.mannWhitney.z.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.mannWhitney.p, 3)}</td>
              </tr>
            </tbody>
          </table>
          <p style={noteStyle}>Note. Mann-Whitney U Test for two independent samples.</p>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[23] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[23]}
            </div>
          )}
        </div>
      )}

      {results.kruskalWallis && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Kruskal-Wallis Test Ranks</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Group</th>
                <th style={thStyle}>N</th>
                <th style={thStyle}>Median</th>
                <th style={thStyle}>Mean Rank</th>
                <th style={thStyle}>Rank Sum</th>
              </tr>
            </thead>
            <tbody>
              {results.kruskalWallis.groups.map((g: any, idx: number) => (
                <tr key={idx}>
                  <td style={tdStyle}>{results.kruskalWallis.groupLabels?.[idx] ?? `Group ${idx + 1}`}</td>
                  <td style={tdStyle}>{g.n}</td>
                  <td style={tdStyle}>{g.median.toFixed(2)}</td>
                  <td style={tdStyle}>{g.meanRank.toFixed(2)}</td>
                  <td style={tdStyle}>{g.rankSum.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[24] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[24]}
            </div>
          )}
        </div>
      )}

      {results.kruskalWallis && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Kruskal-Wallis Test Statistics</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>N</th>
                <th style={thStyle}>H (Chi-Square)</th>
                <th style={thStyle}>df</th>
                <th style={thStyle}>Sig.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{results.kruskalWallis.N}</td>
                <td style={tdStyle}>{results.kruskalWallis.h.toFixed(3)}</td>
                <td style={tdStyle}>{results.kruskalWallis.df}</td>
                <td style={tdStyle}>{formatSpssValue(results.kruskalWallis.p, 3)}</td>
              </tr>
            </tbody>
          </table>
          <p style={noteStyle}>Note. Kruskal-Wallis H Test for k independent samples.</p>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[25] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[25]}
            </div>
          )}
        </div>
      )}

      {results.moderation && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Moderation Model Summary</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>R</th>
                <th style={thStyle}>R²</th>
                <th style={thStyle}>Adjusted R²</th>
                <th style={thStyle}>Std. Error</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{results.moderation.modelSummary.r.toFixed(3)}</td>
                <td style={tdStyle}>{results.moderation.modelSummary.rSquared.toFixed(3)}</td>
                <td style={tdStyle}>{results.moderation.modelSummary.adjRSquared.toFixed(3)}</td>
                <td style={tdStyle}>{results.moderation.modelSummary.stdError.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[26] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[26]}
            </div>
          )}
        </div>
      )}

      {results.moderation && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Moderation Coefficients</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Term</th>
                <th style={thStyle}>B</th>
                <th style={thStyle}>SE</th>
                <th style={thStyle}>Beta</th>
                <th style={thStyle}>t</th>
                <th style={thStyle}>Sig.</th>
              </tr>
            </thead>
            <tbody>
              {results.moderation.coefficients.map((c: any, i: number) => (
                <tr key={i}>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.B.toFixed(3)}</td>
                  <td style={tdStyle}>{c.SE.toFixed(3)}</td>
                  <td style={tdStyle}>{c.beta !== null ? c.beta.toFixed(3) : '-'}</td>
                  <td style={tdStyle}>{c.t.toFixed(3)}</td>
                  <td style={tdStyle}>{formatSpssValue(c.p, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={noteStyle}>Note. Moderation of {results.moderation.predictorName} x {results.moderation.moderatorName} on {results.moderation.outcomeName}.</p>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[27] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[27]}
            </div>
          )}
        </div>
      )}

      {results.mediation && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Mediation Path Coefficients</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Path</th>
                <th style={thStyle}>Coefficient</th>
                <th style={thStyle}>SE</th>
                <th style={thStyle}>t</th>
                <th style={thStyle}>Sig.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>a (Predictor -&gt; Mediator)</td>
                <td style={tdStyle}>{results.mediation.pathA.coefficient.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.pathA.se.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.pathA.t.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.mediation.pathA.p, 3)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>b (Mediator -&gt; Outcome)</td>
                <td style={tdStyle}>{results.mediation.pathB.coefficient.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.pathB.se.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.pathB.t.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.mediation.pathB.p, 3)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>c' (Direct Effect)</td>
                <td style={tdStyle}>{results.mediation.pathCPrime.coefficient.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.pathCPrime.se.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.pathCPrime.t.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.mediation.pathCPrime.p, 3)}</td>
              </tr>
              <tr>
                <td style={tdStyle}>c (Total Effect)</td>
                <td style={tdStyle}>{results.mediation.totalEffect.coefficient.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.totalEffect.se.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.totalEffect.t.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.mediation.totalEffect.p, 3)}</td>
              </tr>
            </tbody>
          </table>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[28] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[28]}
            </div>
          )}
        </div>
      )}

      {results.mediation && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Table {nextTable()}. Sobel Test for Indirect Effect</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={thStyle}>Indirect Effect (a*b)</th>
                <th style={thStyle}>Sobel SE</th>
                <th style={thStyle}>Sobel Z</th>
                <th style={thStyle}>Sobel p</th>
                <th style={thStyle}>Proportion Mediated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{results.mediation.indirectEffect.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.sobelSE.toFixed(3)}</td>
                <td style={tdStyle}>{results.mediation.sobelZ.toFixed(3)}</td>
                <td style={tdStyle}>{formatSpssValue(results.mediation.sobelP, 3)}</td>
                <td style={tdStyle}>{results.mediation.proportionMediated !== null ? (results.mediation.proportionMediated * 100).toFixed(1) + '%' : '-'}</td>
              </tr>
            </tbody>
          </table>
          {viewMode === 'fullDocument' && Object.values(tableInterpretations)[29] && (
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '12px 16px', margin: '10px 0 0 0', fontSize: '13px', color: '#333333', lineHeight: 1.6 }}>
              {Object.values(tableInterpretations)[29]}
            </div>
          )}
        </div>
      )}
✓ Saved to your Bunker</p>
      </div>

      
        {interpretation && Object.keys(tableInterpretations || {}).length > 0 && (
          <div style={{ maxWidth: '800px', margin: '32px auto', padding: '24px 16px', borderTop: '2px solid #D4AF37' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '16px' }}>Interpretation</h2>
            {Object.entries(tableInterpretations).map(([title, block], idx) => (
              <div key={idx} style={{ marginBottom: '24px' }}>
                <p style={{ fontWeight: 600, fontSize: '13px', color: '#333333', marginBottom: '6px' }}>{title}</p>
                <p style={{ fontSize: '14px', color: '#333333', lineHeight: 1.6 }}>{String(block)}</p>
              </div>
            ))}
            {discussion && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Discussion</h3>
                <p style={{ fontSize: '14px', color: '#333333', lineHeight: 1.6 }}>{discussion}</p>
              </div>
            )}
          </div>
        )}

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
