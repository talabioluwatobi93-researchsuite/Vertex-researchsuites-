'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { mergeAndDownload } from '@/lib/chapter5Docx'
import { qualAuthHeaders } from '@/lib/qualAuth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function QualChapter5Page() {
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<'offer' | 'form' | 'generating' | 'holding' | 'done'>('offer')
  const [errorMsg, setErrorMsg] = useState('')
  const [price, setPrice] = useState(0)
  const [balance, setBalance] = useState(0)

  const [problemStatement, setProblemStatement] = useState('')
  const [methodology, setMethodology] = useState('')
  const [limitations, setLimitations] = useState('')
  const [chapter5Content, setChapter5Content] = useState('')
  const [prepBusy, setPrepBusy] = useState(false)
  const [prepDone, setPrepDone] = useState(false)
  const [prepMsg, setPrepMsg] = useState('')
  const [processing, setProcessing] = useState(false)
    const [chapter5ReadyAt, setChapter5ReadyAt] = useState<string | null>(null)
    const [holdSecondsLeft, setHoldSecondsLeft] = useState(0)

  useEffect(() => { load() }, [id])

  function beginHold(readyAt: string | null, alreadyRevealed: boolean, content: string) {
    if (!readyAt) { setStage('done'); return }
    const HOLD_MS = 25 * 1000
    const target = new Date(readyAt).getTime() + HOLD_MS
    const now = Date.now()
    if (now >= target) {
      if (!alreadyRevealed) revealChapter5(content); else setStage('done')
      return
    }
    setStage('holding')
    setHoldSecondsLeft(Math.ceil((target - now) / 1000))
    const interval = setInterval(() => {
      const remaining = Math.ceil((target - Date.now()) / 1000)
      if (remaining <= 0) {
        clearInterval(interval)
        if (!alreadyRevealed) revealChapter5(content); else setStage('done')
      } else {
        setHoldSecondsLeft(remaining)
      }
    }, 1000)
  }

  async function revealChapter5(content: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user?.id) {
      await supabase.from('bunker_items').insert({
        user_id: userData.user.id,
        item_name: 'Chapter 5 (Summary, Conclusion, Recommendations)',
        item_type: 'qualitative_analysis_chapter5',
        content_reference: id,
        is_read: false,
      })
    }
    await supabase.from('qualitative_analysis_sessions').update({ chapter5_revealed: true }).eq('id', id)
    mergeAndDownload(supabase, 'qualitative_analysis_sessions', String(id))
    setStage('done')
  }

  async function handlePrepQuestions() {
    setPrepBusy(true)
    setPrepMsg('')
    try {
      const { data: cur } = await supabase
        .from('qualitative_analysis_sessions')
        .select('defense_prep_content, defense_prep_revealed')
        .eq('id', id)
        .single()
      const have = Array.isArray(cur?.defense_prep_content) && cur.defense_prep_content.length > 0
      if (!have) {
        const res = await fetch('/api/qualitative-analysis/defense-prep', {
          method: 'POST',
          headers: await qualAuthHeaders(supabase),
          body: JSON.stringify({ sessionId: id }),
        })
        const data = await res.json()
        if (!res.ok) {
          setPrepMsg(data.error || 'Could not prepare the questions. Please try again.')
          setPrepBusy(false)
          return
        }
      }
      if (!cur?.defense_prep_revealed) {
        const { data: ud } = await supabase.auth.getUser()
        if (ud?.user?.id) {
          await supabase.from('bunker_items').insert({
            user_id: ud.user.id,
            item_name: 'Defense Prep (Likely Questions & Answers)',
            item_type: 'qualitative_analysis_defense_prep',
            content_reference: id,
            is_read: false,
          })
        }
        await supabase.from('qualitative_analysis_sessions').update({ defense_prep_revealed: true }).eq('id', id)
      }
      setPrepDone(true)
      const rr = await mergeAndDownload(supabase, 'qualitative_analysis_sessions', String(id))
      if (rr === 'done') setPrepMsg('Your Word file with Chapter 5 and the 20 questions has downloaded.')
      else setPrepMsg('Your questions are ready. Tap "Merge and download" above to get the file.')
    } catch (e: any) {
      setPrepMsg('This took too long or failed. Please tap the button again.')
    }
    setPrepBusy(false)
  }

  async function load() {
    setLoading(true)
    const { data: priceRow } = await supabase.from('feature_pricing').select('price').eq('feature_name', 'chapter_5').single()
    setPrice(priceRow?.price ?? 0)

    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user?.id) {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', userData.user.id).single()
      setBalance(wallet?.balance ?? 0)
    }

    const { data: session, error } = await supabase
      .from('qualitative_analysis_sessions')
      .select('chapter5_paid, chapter5_content, chapter5_ready_at, chapter5_revealed, results')
      .eq('id', id)
      .single()

    if (error || !session) { setErrorMsg('Could not load this session.'); setLoading(false); return }
    if (!session.results) { setErrorMsg('Please complete your main analysis before adding Chapter 5.'); setLoading(false); return }
    if (session.chapter5_paid && session.chapter5_content) { setChapter5Content(session.chapter5_content); setChapter5ReadyAt(session.chapter5_ready_at); beginHold(session.chapter5_ready_at, session.chapter5_revealed, session.chapter5_content); return }

    setLimitations('This study was limited to the transcripts analyzed, which may not capture the full range of perspectives on this topic. The findings are context-specific and may not generalize beyond the study\u2019s participants.')
    setLoading(false)
  }

  async function handleProceedToForm() {
    if (price > 0 && balance < price) { setErrorMsg('Your balance is not enough for this add-on. Kindly top up.'); return }
    setErrorMsg(''); setStage('form')
  }

  async function handleGenerate() {
    if (!problemStatement.trim() || !methodology.trim() || !limitations.trim()) {
      setErrorMsg('Please fill in all three fields before continuing.'); return
    }
    setProcessing(true); setErrorMsg('')

    if (price > 0) {
      const { data: userData } = await supabase.auth.getUser()
      const chargeOut: any = Number(price) > 0 ? await supabase.rpc('charge_feature', { p_description: 'Qualitative Chapter 5', p_amount: price }) : { data: { ok: true }, error: null }
    const deductError = (chargeOut.error || !chargeOut.data || chargeOut.data.error) ? true : null
      if (deductError) { setErrorMsg('Something went wrong deducting from your wallet.'); setProcessing(false); return }
    }

    await supabase.from('qualitative_analysis_sessions').update({ chapter5_inputs: { problemStatement, methodology, limitations } }).eq('id', id)
    setStage('generating')

    try {
      const res = await fetch('/api/qualitative-analysis/chapter5', {
        method: 'POST', headers: await qualAuthHeaders(supabase), body: JSON.stringify({ sessionId: id })
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Chapter 5 generation failed.'); setProcessing(false); setStage('form'); return }
      setChapter5Content(data.chapter5_content); setChapter5ReadyAt(data.chapter5_ready_at); beginHold(data.chapter5_ready_at, false, data.chapter5_content)
    } catch (e) { setErrorMsg('Something went wrong.'); setStage('form') }
    setProcessing(false)
  }

  if (loading) return <div style={{ padding: '60px 20px', textAlign: 'center' }}><p style={{ color: '#777777', fontSize: '14px' }}>Loading...</p></div>
  if (errorMsg && stage === 'offer' && !chapter5Content) {
    return <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 16px' }}><div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '16px' }}><p style={{ color: '#C0392B', fontSize: '14px', margin: 0 }}>{errorMsg}</p></div></div>
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
      {stage === 'offer' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #EEEEEE', textAlign: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Add Chapter 5?</h1>
          <p style={{ fontSize: '13px', color: '#777777', marginBottom: '4px' }}>Summary, Conclusion, Limitations & Recommendations \u2014 built from your findings.</p>
          <p style={{ fontSize: '20px', fontWeight: 700, color: '#D4AF37', margin: '16px 0' }}>{price === 0 ? 'Free' : `\u20A6${price.toLocaleString()}`}</p>
          {errorMsg && <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}><p style={{ color: '#C0392B', fontSize: '12px', margin: 0 }}>{errorMsg}</p></div>}
          <button onClick={handleProceedToForm} style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Yes, add Chapter 5</button>
        </div>
      )}
      {stage === 'form' && (
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '6px' }}>A Few More Details</h1>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '14px' }}>
            <label style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Problem Statement</label>
            <textarea value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} rows={4} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px', color: '#333333', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '14px' }}>
            <label style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Methodology</label>
            <textarea value={methodology} onChange={(e) => setMethodology(e.target.value)} placeholder="Design, participants, sampling technique, data collection procedure." rows={4} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px', color: '#333333', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
            <label style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Limitations</label>
            <textarea value={limitations} onChange={(e) => setLimitations(e.target.value)} rows={4} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px', color: '#333333', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          {errorMsg && <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}><p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p></div>}
          <button onClick={handleGenerate} disabled={processing} style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            {processing ? 'Processing...' : 'Generate Chapter 5'}
          </button>
        </div>
      )}
      {stage === 'generating' && <div style={{ padding: '60px 20px', textAlign: 'center' }}><p style={{ color: '#777777', fontSize: '14px' }}>Writing your Chapter 5...</p></div>}
      {stage === 'holding' && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Finalizing your Chapter 5...</h1>
          <p style={{ color: '#777777', fontSize: '14px', marginBottom: '4px' }}>Please be patient, feel free to leave this page.</p>
          <p style={{ color: '#777777', fontSize: '13px' }}>Ready in {holdSecondsLeft}s</p>
        </div>
      )}
      {stage === 'done' && (
        <div style={{ textAlign: 'right', marginBottom: '12px' }}>
          <button
            onClick={async () => {
              const r = await mergeAndDownload(supabase, 'qualitative_analysis_sessions', String(id))
              if (r === 'not_ready') window.alert('Reveal both Chapter 5 and Defense Prep first, then tap again.')
              if (r === 'error') window.alert('Could not build the file. Please try again.')
            }}
            style={{ backgroundColor: '#D4AF37', color: '#111111', border: 'none', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            Merge and download
          </button>
        </div>
      )}
      {stage === 'done' && (
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#333333', marginBottom: '16px' }}>Chapter 5</h1>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE' }}>
            {chapter5Content.split('\n').filter(Boolean).map((para, i) => <p key={i} style={{ fontSize: '13px', color: '#333333', lineHeight: '1.7', marginBottom: '12px' }}>{para}</p>)}
          </div>
        {prepMsg && (
          <p style={{ color: prepDone ? '#2E7D32' : '#C0392B', fontSize: '13px', marginTop: '12px' }}>{prepMsg}</p>
        )}
        {!prepDone && (
          <button
            onClick={handlePrepQuestions}
            disabled={prepBusy}
            style={{ width: '100%', marginTop: '16px', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            {prepBusy ? 'Preparing your 20 questions...' : 'Get prep questions'}
          </button>
        )}
        </div>
      )}
    </div>
  )
}
