'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const spinStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  border: '2px solid rgba(51,51,51,0.3)',
  borderTopColor: '#333333',
  borderRadius: '50%',
  display: 'inline-block',
  animation: 'spin 0.8s linear infinite',
}

function splitIntoPages(text: string, wordsPerPage = 250) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [text]
  const pages: string[] = []
  let currentPage = ''
  let currentWordCount = 0
  for (const sentence of sentences) {
    const sentenceWordCount = sentence.trim().split(/\s+/).filter(Boolean).length
    if (currentWordCount + sentenceWordCount > wordsPerPage && currentPage.length > 0) {
      pages.push(currentPage.trim())
      currentPage = sentence
      currentWordCount = sentenceWordCount
    } else {
      currentPage += sentence
      currentWordCount += sentenceWordCount
    }
  }
  if (currentPage.trim().length > 0) pages.push(currentPage.trim())
  return pages
}

export default function WritingCheckPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pricePerPage, setPricePerPage] = useState(0)
  const [userId, setUserId] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      try {
        const { data } = await supabase
          .from('feature_pricing')
          .select('price')
          .eq('feature_name', 'writing_check')
          .single()
        setPricePerPage(data?.price ?? 0)
      } catch {
        setPricePerPage(0)
      }
    }
    init()
  }, [])

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const pages = splitIntoPages(text)
  const pageCount = pages.length
  const totalPrice = pageCount * pricePerPage
  const formattedPrice = totalPrice.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleButtonClick = () => {
    if (!text.trim() || wordCount === 0) {
      setErrorMsg('Please paste your writing first.')
      return
    }
    setErrorMsg('')
    if (totalPrice === 0) {
      handleSubmit()
    } else {
      setShowConfirm(true)
    }
  }

  const handleAccept = async () => {
    setShowConfirm(false)
    setErrorMsg('')
    setLoading(true)
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single()
      const balance = wallet?.balance ?? 0
      if (balance < totalPrice) {
        setErrorMsg('Your balance is not enough, kindly top up.')
        setLoading(false)
        return
      }
      const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: balance - totalPrice })
        .eq('user_id', userId)
      if (deductError) {
        setErrorMsg('Could not process payment. Please try again.')
        setLoading(false)
        return
      }
      await handleSubmit()
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const scanIds: string[] = []
      for (const page of pages) {
        const res = await fetch('/api/writing-check/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: page, userId }),
        })
        const data = await res.json()
        if (data.scanId) scanIds.push(data.scanId)
      }
      if (scanIds.length === 0) {
        setErrorMsg('Could not submit for checking. Please try again.')
        setLoading(false)
        return
      }
      router.push(`/writing-check/results?scans=${scanIds.join(',')}`)
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
        Writing Check &amp; Polish
      </h1>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#333333', marginBottom: '6px', display: 'block' }}>
          Paste your writing below
        </label>
        <textarea
          style={{ width: '100%', minHeight: '260px', padding: '14px', borderRadius: '12px', border: '1px solid #DDDDDD', fontSize: '14px', color: '#333333', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your essay, assignment, or research writing here..."
        />

        <p style={{ fontSize: '12px', color: '#777777', marginBottom: '16px' }}>
          {wordCount} words &middot; {pageCount} page{pageCount !== 1 ? 's' : ''}
        </p>

        {errorMsg && (
          <p style={{ color: '#C0392B', fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>
        )}

        <button
          onClick={handleButtonClick}
          disabled={loading || !text.trim()}
          style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          {loading ? (
            <>
              <span style={spinStyle} />
              Checking your writing...
            </>
          ) : 'Check My Writing'}
        </button>
      </div>

      {showConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 100 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center' }}>
            <p style={{ color: '#333333', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Confirm Payment</p>
            <p style={{ color: '#555555', fontSize: '14px', marginBottom: '20px' }}>
              ₦{formattedPrice} will be deducted from your wallet to check {pageCount} page{pageCount !== 1 ? 's' : ''}. Do you want to proceed?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, backgroundColor: '#EEEEEE', color: '#333333', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
              <button onClick={handleAccept} style={{ flex: 1, backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Accept</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
