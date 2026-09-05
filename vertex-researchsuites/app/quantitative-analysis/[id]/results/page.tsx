'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const HOLD_MS = 3 * 60 * 1000 // 3 minutes

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
  const [status, setStatus] = useState('Calculating results...')
  const [results, setResults] = useState<any>(null)
  const [interpretation, setInterpretation] = useState('')
  const [discussion, setDiscussion] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [gateInfo, setGateInfo] = useState<any>({ constructs: [], response_rate_info: null, reliability_info: null })

  useEffect(() => {
    init()
  }, [id])

  async function init() {
    try {
      // 1. Check if this session already has computed results stored
      const { data: session, error: sessionErr } = await supabase
        .from('quantitative_analysis_sessions')
        .select('results_json, interpretation, discussion, results_ready_at, results_revealed, constructs, response_rate_info, reliability_info')
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

      setResults(finalResults)
      setInterpretation(finalInterpretation || '')
      setDiscussion(finalDiscussion || '')

      // 3. Work out whether the 3-minute hold has passed
      const readyTime = new Date(readyAt).getTime()
      const revealTime = readyTime + HOLD_MS
      const now = Date.now()

      if (session?.results_revealed || now >= revealTime) {
        await revealNow(finalResults)
      } else {
        setStatus('holding')
        const msLeft = revealTime - now
        setSecondsLeft(Math.ceil(msLeft / 1000))
        const interval = setInterval(() => {
          setSecondsLeft((s) => {
            if (s <= 1) {
              clearInterval(interval)
              revealNow(finalResults)
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

  if (status !== 'done' || !results) {
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
                  <td style={tdStyle}>{results.ttest.levene.p.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.t.toFixed(3)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.df.toFixed(0)}</td>
                  <td style={tdStyle}>{results.ttest.equalVariances.p.toFixed(3)}</td>
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
                  <td style={tdStyle}>{results.ttest.unequalVariances.p.toFixed(3)}</td>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  <td style={tdStyle}>{results.anova.p.toFixed(3)}</td>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                    <td style={tdStyle}>{t.p.toFixed(3)}</td>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
        
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Results Interpretation</h2>
        {interpretation.split('\n').filter(Boolean).map((para, i) => (
          <p key={i} style={{ fontSize: '13px', color: '#333333', lineHeight: '1.7', marginBottom: '12px' }}>{para}</p>
        ))}
      </div>

      {discussion && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>General Findings & Discussion</h2>
          {discussion.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ fontSize: '13px', color: '#333333', lineHeight: '1.7', marginBottom: '12px' }}>{para}</p>
          ))}
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #D4AF37', marginBottom: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#333333', fontWeight: 600, margin: 0 }}>✓ Saved to your Bunker</p>
      </div>

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
