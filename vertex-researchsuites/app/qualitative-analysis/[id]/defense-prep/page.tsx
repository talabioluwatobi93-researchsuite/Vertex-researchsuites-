'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)

type QA = { category: string; question: string; answer: string }

export default function QualDefensePrepPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<'offer' | 'generating' | 'holding' | 'done'>('offer')
  const [errorMsg, setErrorMsg] = useState('')
  const [price, setPrice] = useState(0)
  const [balance, setBalance] = useState(0)
  const [processing, setProcessing] = useState(false)
    const [defensePrepReadyAt, setDefensePrepReadyAt] = useState<string | null>(null)
    const [holdSecondsLeft, setHoldSecondsLeft] = useState(0)
  const [qaList, setQaList] = useState<QA[]>([])
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => { load() }, [id])

  function beginHold(readyAt: string | null, alreadyRevealed: boolean, content: QA[]) {
    if (!readyAt) { setStage('done'); return }
    const HOLD_MS = 60 * 1000
    const target = new Date(readyAt).getTime() + HOLD_MS
    const now = Date.now()
    if (now >= target) {
      if (!alreadyRevealed) revealDefensePrep(content); else setStage('done')
      return
    }
    setStage('holding')
    setHoldSecondsLeft(Math.ceil((target - now) / 1000))
    const interval = setInterval(() => {
      const remaining = Math.ceil((target - Date.now()) / 1000)
      if (remaining <= 0) {
        clearInterval(interval)
        if (!alreadyRevealed) revealDefensePrep(content); else setStage('done')
      } else {
        setHoldSecondsLeft(remaining)
      }
    }, 1000)
  }

  async function revealDefensePrep(content: QA[]) {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user?.id) {
      await supabase.from('bunker_items').insert({
        user_id: userData.user.id,
        item_name: 'Defense Prep (Likely Questions & Answers)',
        item_type: 'qualitative_analysis_defense_prep',
        content_reference: id,
        is_read: false,
      })
    }
    await supabase.from('qualitative_analysis_sessions').update({ defense_prep_revealed: true }).eq('id', id)
    setStage('done')
  }

  async function load() {
    setLoading(true)
    const { data: priceRow } = await supabase.from('feature_pricing').select('price').eq('feature_name', 'defense_prep').single()
    setPrice(priceRow?.price ?? 0)

    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user?.id) {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', userData.user.id).single()
      setBalance(wallet?.balance ?? 0)
    }

    const { data: session, error } = await supabase.from('qualitative_analysis_sessions').select('defense_prep_paid, defense_prep_content, defense_prep_ready_at, defense_prep_revealed, results').eq('id', id).single()
    if (error || !session) { setErrorMsg('Could not load this session.'); setLoading(false); return }
    if (!session.results) { setErrorMsg('Please complete your main analysis before preparing for your defense.'); setLoading(false); return }
    if (session.defense_prep_paid && session.defense_prep_content) { setQaList(session.defense_prep_content); setDefensePrepReadyAt(session.defense_prep_ready_at); beginHold(session.defense_prep_ready_at, session.defense_prep_revealed, session.defense_prep_content); return }
    setLoading(false)
  }

  async function handleGenerate() {
    if (price > 0 && balance < price) { setErrorMsg('Your balance is not enough for this add-on. Kindly top up.'); return }
    setProcessing(true); setErrorMsg('')
    if (price > 0) {
      const { data: userData } = await supabase.auth.getUser()
      const { error: deductError } = await supabase.from('wallets').update({ balance: balance - price }).eq('id', userData?.user?.id)
      if (deductError) { setErrorMsg('Something went wrong deducting from your wallet.'); setProcessing(false); return }
    }
    setStage('generating')
    try {
      const res = await fetch('/api/qualitative-analysis/defense-prep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }) })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Defense prep generation failed.'); setProcessing(false); setStage('offer'); return }
      setQaList(data.defense_prep_content); setDefensePrepReadyAt(data.defense_prep_ready_at); beginHold(data.defense_prep_ready_at, false, data.defense_prep_content)
    } catch (e) { setErrorMsg('Something went wrong.'); setStage('offer') }
    setProcessing(false)
  }

  if (loading) return <div style={{ padding: '60px 20px', textAlign: 'center' }}><p style={{ color: '#777777', fontSize: '14px' }}>Loading...</p></div>
  if (errorMsg && stage === 'offer' && qaList.length === 0) {
    return <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 16px' }}><div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '16px' }}><p style={{ color: '#C0392B', fontSize: '14px', margin: 0 }}>{errorMsg}</p></div></div>
  }

  const grouped = qaList.reduce((acc: Record<string, QA[]>, qa) => { if (!acc[qa.category]) acc[qa.category] = []; acc[qa.category].push(qa); return acc }, {})

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '24px 16px' }}>
      {stage === 'offer' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #EEEEEE', textAlign: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Prepare for Your Defense</h1>
          <p style={{ fontSize: '13px', color: '#777777', marginBottom: '4px' }}>Likely questions about your coding and theme choices, built from your actual data.</p>
          <p style={{ fontSize: '20px', fontWeight: 700, color: '#D4AF37', margin: '16px 0' }}>{price === 0 ? 'Free' : `\u20A6${price.toLocaleString()}`}</p>
          {errorMsg && <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}><p style={{ color: '#C0392B', fontSize: '12px', margin: 0 }}>{errorMsg}</p></div>}
          <button onClick={handleGenerate} disabled={processing} style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            {processing ? 'Processing...' : 'Generate Defense Prep'}
          </button>
        </div>
      )}
      {stage === 'generating' && <div style={{ padding: '60px 20px', textAlign: 'center' }}><p style={{ color: '#777777', fontSize: '14px' }}>Preparing your likely questions...</p></div>}
      {stage === 'holding' && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Finalizing your Defense Prep...</h1>
          <p style={{ color: '#777777', fontSize: '14px', marginBottom: '4px' }}>Please be patient, feel free to leave this page.</p>
          <p style={{ color: '#777777', fontSize: '13px' }}>Ready in {holdSecondsLeft}s</p>
        </div>
      )}
      {stage === 'done' && (
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '4px' }}>Defense Prep</h1>
          <p style={{ fontSize: '12px', color: '#777777', marginBottom: '20px' }}>Tap a question to reveal the answer.</p>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#D4AF37', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{category}</p>
              {items.map((qa, i) => {
                const globalIndex = qaList.indexOf(qa)
                const isOpen = openIndex === globalIndex
                return (
                  <div key={i} onClick={() => setOpenIndex(isOpen ? null : globalIndex)} style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #EEEEEE', marginBottom: '10px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#333333', margin: 0, flex: 1 }}>{qa.question}</p>
                      <span style={{ color: '#D4AF37', fontSize: '16px', marginLeft: '10px' }}>{isOpen ? '\u2212' : '+'}</span>
                    </div>
                    {isOpen && <p style={{ fontSize: '13px', color: '#555555', lineHeight: '1.6', marginTop: '10px', marginBottom: 0 }}>{qa.answer}</p>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
