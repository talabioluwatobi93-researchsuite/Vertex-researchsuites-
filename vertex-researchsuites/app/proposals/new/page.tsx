'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function NewProposal() {
  const [institution, setInstitution] = useState('')
  const [course, setCourse] = useState('')
  const [department, setDepartment] = useState('')
  const [sequence, setSequence] = useState('')
  const [loading, setLoading] = useState(false)
  const [topics, setTopics] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      try {
        const { data } = await supabase
          .from('feature_pricing')
          .select('price')
          .eq('feature_name', 'research_topics')
          .single()

        setPrice(data?.price ?? 0)
      } catch {
        setPrice(0)
      }
    }

    init()
  }, [])

  const handleButtonClick = () => {
    if (!institution || !course || !department) return
    setErrorMsg('')

    if (price === 0) {
      handleGenerate()
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

      if (balance < price) {
        setErrorMsg('Your balance is not enough, kindly top up.')
        setLoading(false)
        return
      }

      const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: balance - price })
        .eq('user_id', userId)

      if (deductError) {
        setErrorMsg('Could not process payment. Please try again.')
        setLoading(false)
        return
      }

      await handleGenerate()
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setTopics('')
    setLoading(true)

    try {
      const res = await fetch('/api/generate-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution, course, department, sequence }),
      })
      const data = await res.json()
      setTopics(data.topics)
    } catch {
      setTopics('Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #DDDDDD',
    fontSize: '14px',
    color: '#333333',
    marginBottom: '14px',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#333333',
    marginBottom: '6px',
    display: 'block',
  }

  const formattedPrice = price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
        Get Research Topics & Proposals
      </h1>

      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: price === 0 ? '#E7F6EC' : '#FFF6E0',
        color: price === 0 ? '#1D8A4C' : '#B8860B',
        fontSize: '13px',
        fontWeight: 700,
        padding: '6px 14px',
        borderRadius: '20px',
        marginBottom: '20px',
      }}>
        {price === 0 ? 'Free' : `₦${formattedPrice} will be deducted from your wallet`}
      </div>

      {!topics && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE' }}>
          <label style={labelStyle}>Institution</label>
          <input style={inputStyle} value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. University of Lagos" />

          <label style={labelStyle}>Course of Study</label>
          <input style={inputStyle} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Computer Science" />

          <label style={labelStyle}>Department</label>
          <input style={inputStyle} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Physical Sciences" />

          <label style={labelStyle}>Specific Focus (optional)</label>
          <input style={inputStyle} value={sequence} onChange={(e) => setSequence(e.target.value)} placeholder="e.g. Artificial Intelligence, Renewable Energy" />

          <button
            onClick={handleButtonClick}
            disabled={loading || !institution || !course || !department}
            style={{
              width: '100%',
              backgroundColor: '#D4AF37',
              color: '#333333',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            {loading ? 'Processing...' : price === 0 ? 'Generate 5 Topics (Free)' : `Generate 5 Topics — ₦${formattedPrice}`}
          </button>

          {errorMsg && (
            <p style={{ color: '#C0392B', fontSize: '13px', fontWeight: 600, marginTop: '12px', textAlign: 'center' }}>
              {errorMsg}
            </p>
          )}
        </div>
      )}

      {topics && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE' }}>
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: '14px',
            color: '#333333',
            lineHeight: '1.6',
            margin: 0,
          }}>
            {topics}
          </pre>

          <button
            onClick={() => setTopics('')}
            style={{
              marginTop: '16px',
              backgroundColor: '#333333',
              color: '#D4AF37',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Generate Again
          </button>
        </div>
      )}

      {showConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '24px',
            maxWidth: '340px',
            width: '100%',
            textAlign: 'center',
          }}>
            <p style={{ color: '#333333', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              Confirm Payment
            </p>
            <p style={{ color: '#555555', fontSize: '14px', marginBottom: '20px' }}>
              ₦{formattedPrice} will be deducted from your wallet to generate these topics. Do you want to proceed?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#EEEEEE',
                  color: '#333333',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reject
              </button>
              <button
                onClick={handleAccept}
                style={{
                  flex: 1,
                  backgroundColor: '#D4AF37',
                  color: '#333333',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
