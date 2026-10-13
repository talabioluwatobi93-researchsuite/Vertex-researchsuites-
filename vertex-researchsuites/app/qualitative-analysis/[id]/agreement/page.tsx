'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { qualAuthHeaders } from '@/lib/qualAuth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type AgreementResult = {
  kappa: number | null
  reliable: boolean
  message: string
  percentAgreement: number
  unitsCompared: number
  totalUnits: number
  failedBatches: number[]
  smallSample?: boolean
  disagreementCount?: number
  disagreements?: { blockIndex: number; participantId: string; excerpt: string; coderA: string; coderB: string }[]
}

const API = '/api/qualitative-analysis/code-agreement'
const RUNNING_TEXT = 'Checking agreement between two independent coders...'

export default function AgreementPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [phase, setPhase] = useState<'running' | 'result' | 'error'>('running')
  const [progress, setProgress] = useState(RUNNING_TEXT)
  const [result, setResult] = useState<AgreementResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    start()
  }, [id])

  async function call(body: any) {
    const headers = await qualAuthHeaders(supabase)
    const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify({ sessionId: id, ...body }) })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  async function start() {
    const { data: session } = await supabase
      .from('qualitative_analysis_sessions')
      .select('agreement')
      .eq('id', id)
      .single()
    const ag: any = session?.agreement
    if (ag?.decision === 'proceed') {
      router.replace(`/qualitative-analysis/${id}/results`)
      return
    }
    if (ag?.result && !ag.decision) {
      setResult(ag.result)
      setPhase('result')
      return
    }
    await runCheck()
  }

  async function runCheck() {
    setPhase('running')
    setErrorMsg('')
    let batch = 1
    let batchCount = 1
    while (batch <= batchCount) {
      setProgress(batchCount > 1 ? RUNNING_TEXT + ' part ' + batch + ' of ' + batchCount : RUNNING_TEXT)
      let ok = false
      let data: any = {}
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          const r = await call({ action: 'batch', batch })
          ok = r.res.ok
          data = r.data
          if (!ok && (r.res.status === 401 || r.res.status === 404)) break
        } catch {
          ok = false
        }
      }
      if (ok) {
        batchCount = data.batchCount || 1
      } else if (batch === 1) {
        setErrorMsg(data?.error || 'The agreement check could not start. Please try again.')
        setPhase('error')
        return
      }
      batch++
    }
    try {
      const r = await call({ action: 'finalize' })
      if (!r.res.ok || !r.data?.result) {
        setErrorMsg(r.data?.error || 'Could not calculate agreement. Please try again.')
        setPhase('error')
        return
      }
      setResult(r.data.result)
      setPhase('result')
    } catch {
      setErrorMsg('Could not calculate agreement. Please try again.')
      setPhase('error')
    }
  }

  async function decide(decision: 'proceed' | 'stop') {
    setBusy(true)
    setErrorMsg('')
    try {
      const r = await call({ action: 'decide', decision })
      if (!r.res.ok) {
        setErrorMsg(r.data?.error || 'Something went wrong. Please try again.')
        setBusy(false)
        return
      }
      router.push(decision === 'proceed' ? `/qualitative-analysis/${id}/results` : `/qualitative-analysis/${id}/theming`)
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  const wrap = { backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '40px 16px' }
  const card = { maxWidth: '700px', margin: '0 auto', backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1px solid #EEEEEE' }
  const btn = { padding: '10px 18px', borderRadius: '10px', border: '1px solid #D4AF37', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }

  if (phase === 'running') {
    return (
      <div style={{ ...wrap, textAlign: 'center' as const }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>{progress}</p>
        <p style={{ color: '#999999', fontSize: '12px' }}>This can take a few minutes for a long transcript. Please keep this page open.</p>
      </div>
    )
  }

  if (phase === 'error' || !result) {
    return (
      <div style={wrap}>
        <div style={card}>
          <p style={{ color: '#C0392B', fontSize: '14px' }}>{errorMsg || 'Something went wrong.'}</p>
          <button style={{ ...btn, backgroundColor: '#F9F9F9', color: '#333333' }} onClick={() => runCheck()}>Try again</button>
        </div>
      </div>
    )
  }

  const kappaText = result.kappa === null ? '—' : result.kappa.toFixed(2)
  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ color: '#333333', fontSize: '20px', marginTop: 0 }}>Coder agreement check</h2>
        <p style={{ color: '#555555', fontSize: '14px' }}>
          Two independent coders each labelled every paragraph of your transcript using your confirmed themes.
          Cohen&apos;s kappa (κ) measures how often they agree, after removing the agreement expected by chance.
        </p>
        <p style={{ color: '#333333', fontSize: '32px', fontWeight: 700, margin: '16px 0 4px' }}>κ = {kappaText}</p>
        <p style={{ color: '#333333', fontSize: '14px' }}>{result.message}</p>
        <p style={{ color: '#777777', fontSize: '13px' }}>
          Compared {result.unitsCompared} of {result.totalUnits} paragraphs. The coders gave the same label to {result.percentAgreement}% of them.
        </p>
        {result.failedBatches.length > 0 && (
          <p style={{ color: '#B9770E', fontSize: '13px' }}>
            Part {result.failedBatches.join(', ')} of your transcript could not be checked and was left out of this figure.
          </p>
        )}
        {result.smallSample && (
          <p style={{ color: '#B9770E', fontSize: '13px' }}>
            Only {result.unitsCompared} paragraphs were compared. With so few, κ is unstable and should be read with caution.
          </p>
        )}
        {(result.disagreementCount || 0) > 0 && (
          <div style={{ margin: '12px 0' }}>
            <button style={{ ...btn, padding: 0, border: 'none', backgroundColor: 'transparent', color: '#333333', fontSize: '13px', textDecoration: 'underline' }} onClick={() => setShowDiff(!showDiff)}>
              {showDiff ? 'Hide' : 'Show'} where the coders disagreed ({result.disagreementCount})
            </button>
            {showDiff && (
              <div style={{ marginTop: '8px' }}>
                {(result.disagreements || []).slice(0, 20).map((d) => (
                  <div key={d.blockIndex} style={{ borderTop: '1px solid #EEEEEE', padding: '8px 0' }}>
                    <p style={{ color: '#555555', fontSize: '12px', margin: 0 }}>Paragraph {d.blockIndex} ({d.participantId}): {d.excerpt}</p>
                    <p style={{ color: '#333333', fontSize: '12px', margin: '4px 0 0' }}>Coder A: {d.coderA} | Coder B: {d.coderB}</p>
                  </div>
                ))}
                {(result.disagreementCount || 0) > 20 && (
                  <p style={{ color: '#777777', fontSize: '12px' }}>Showing 20 of {result.disagreementCount}. The full list is saved with your analysis.</p>
                )}
              </div>
            )}
          </div>
        )}
        {!result.reliable && (
          <div style={{ backgroundColor: '#FEF5E7', borderRadius: '8px', padding: '12px 16px', margin: '12px 0' }}>
            <p style={{ color: '#7E5109', fontSize: '13px', margin: 0 }}>
              Low agreement can mean your themes are unclear or overlap, so they may be applied inconsistently.
              You can stop and revise your themes, or proceed anyway. If you proceed, your report will state this agreement value.
            </p>
          </div>
        )}
        {errorMsg && <p style={{ color: '#C0392B', fontSize: '13px' }}>{errorMsg}</p>}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' as const }}>
          <button style={{ ...btn, backgroundColor: '#F9F9F9', color: '#333333' }} disabled={busy} onClick={() => decide('proceed')}>
            {result.reliable ? 'Continue to my report' : 'Proceed anyway'}
          </button>
          <button style={{ ...btn, backgroundColor: '#EEEEEE', color: '#333333' }} disabled={busy} onClick={() => decide('stop')}>
            Stop here and revise my themes
          </button>
        </div>
        <p style={{ marginTop: '16px' }}>
          <button style={{ ...btn, padding: 0, border: 'none', backgroundColor: 'transparent', color: '#777777', fontSize: '12px', textDecoration: 'underline' }} disabled={busy} onClick={() => runCheck()}>
            Run the check again
          </button>
        </p>
      </div>
    </div>
  )
}
