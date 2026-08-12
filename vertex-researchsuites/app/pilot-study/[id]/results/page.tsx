'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type ConstructResult = { name: string; k: number; n: number; alpha: number; error?: string }
type CombinedResult = { k: number; n: number; alpha: number } | null

function reliabilityLabel(alpha: number): { label: string; color: string } {
  if (alpha >= 0.9) return { label: 'Excellent', color: '#2E7D32' }
  if (alpha >= 0.8) return { label: 'Good', color: '#558B2F' }
  if (alpha >= 0.7) return { label: 'Acceptable', color: '#D4AF37' }
  if (alpha >= 0.6) return { label: 'Questionable', color: '#E67E22' }
  return { label: 'Poor', color: '#C0392B' }
}

export default function PilotStudyResultsPage() {
  const params = useParams()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [constructResults, setConstructResults] = useState<ConstructResult[]>([])
  const [combined, setCombined] = useState<CombinedResult>(null)
  const [interpretation, setInterpretation] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
    const [holding, setHolding] = useState(false)
    const [holdSecondsLeft, setHoldSecondsLeft] = useState(0)
    const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    function beginHold(readyAt: string | null, cResults: ConstructResult[], comb: CombinedResult, interp: string) {
      if (!readyAt) { setRevealed(true); return }
      const HOLD_MS = 60 * 1000
      const target = new Date(readyAt).getTime() + HOLD_MS
      const now = Date.now()
      if (now >= target) {
        revealPilotStudy(cResults, comb, interp)
        return
      }
      setHolding(true)
      setHoldSecondsLeft(Math.ceil((target - now) / 1000))
      const interval = setInterval(() => {
        const remaining = Math.ceil((target - Date.now()) / 1000)
        if (remaining <= 0) {
          clearInterval(interval)
          revealPilotStudy(cResults, comb, interp)
        } else {
          setHoldSecondsLeft(remaining)
        }
      }, 1000)
    }

    async function revealPilotStudy(cResults: ConstructResult[], comb: CombinedResult, interp: string) {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.id) {
        await supabase.from('bunker_items').insert({
          user_id: userData.user.id,
          item_name: 'Pilot Study - Reliability Test',
          item_type: 'pilot_study',
          content_reference: sessionId,
          is_read: false,
        })
      }
      await supabase.from('pilot_study_sessions').update({ results_revealed: true }).eq('id', sessionId)
      setHolding(false)
      setRevealed(true)
    }

    const run = async () => {
      try {
        const res = await fetch('/api/pilot-study/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json()

        if (!res.ok) {
          setErrorMsg(data.error || 'Something went wrong calculating your results.')
          setLoading(false)
          return
        }

        setConstructResults(data.results.constructs || [])
        setCombined(data.results.combined || null)
        setInterpretation(data.interpretation || '')
        setLoading(false)
        beginHold(data.results_ready_at, data.results.constructs || [], data.results.combined || null, data.interpretation || '')
      } catch (err) {
        setErrorMsg('Something went wrong calculating your results. Please try again.')
        setLoading(false)
      }
    }
    run()
  }, [sessionId])

    if (holding) {
      return (
        <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Finalizing your Pilot Study results...</h1>
          <p style={{ color: '#777777', fontSize: '14px', marginBottom: '4px' }}>Please be patient, feel free to leave this page.</p>
          <p style={{ color: '#777777', fontSize: '13px' }}>Ready in {holdSecondsLeft}s</p>
        </div>
      )
    }

    if (loading) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '48px 20px', border: '1px solid #EEEEEE', textAlign: 'center', marginTop: '60px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid rgba(212,175,55,0.3)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#333333', fontSize: '15px', fontWeight: 600, margin: '0 0 8px' }}>Calculating reliability...</p>
          <p style={{ color: '#777777', fontSize: '13px', margin: 0 }}>Running the real statistics on your data.</p>
        </div>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#C0392B', fontSize: '14px', margin: 0 }}>{errorMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
        Pilot Study Results
      </h1>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #EEEEEE', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ display: 'flex', backgroundColor: '#F9F9F9', padding: '10px 16px', borderBottom: '1px solid #EEEEEE' }}>
          <span style={{ flex: 2, fontSize: '11px', fontWeight: 700, color: '#777777' }}>CONSTRUCT</span>
          <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#777777', textAlign: 'center' }}>ITEMS</span>
          <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#777777', textAlign: 'center' }}>ALPHA</span>
        </div>

        {constructResults.map((c, idx) => {
          const rel = c.error ? null : reliabilityLabel(c.alpha)
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #F0F0F0' }}>
              <span style={{ flex: 2, fontSize: '13px', fontWeight: 600, color: '#333333' }}>{c.name}</span>
              <span style={{ flex: 1, fontSize: '13px', color: '#333333', textAlign: 'center' }}>{c.k}</span>
              <span style={{ flex: 1, textAlign: 'center' }}>
                {c.error ? (
                  <span style={{ fontSize: '11px', color: '#C0392B' }}>N/A</span>
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: rel!.color }}>{c.alpha.toFixed(2)}</span>
                )}
              </span>
            </div>
          )
        })}

        {combined && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', backgroundColor: '#F9F9F9' }}>
            <span style={{ flex: 2, fontSize: '13px', fontWeight: 700, color: '#333333' }}>Total (Combined)</span>
            <span style={{ flex: 1, fontSize: '13px', color: '#333333', textAlign: 'center' }}>{combined.k}</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: reliabilityLabel(combined.alpha).color, textAlign: 'center' }}>
              {combined.alpha.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {interpretation && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Interpretation</p>
          <p style={{ color: '#555555', fontSize: '13px', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{interpretation}</p>
        </div>
      )}

      <p style={{ color: '#777777', fontSize: '13px', textAlign: 'center', margin: '0 0 16px 0' }}>
            ✓ Saved to your Bunker
          </p>
    </div>
  )
}
