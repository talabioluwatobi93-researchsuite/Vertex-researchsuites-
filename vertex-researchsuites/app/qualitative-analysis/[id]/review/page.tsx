'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function ReviewPage() {
  const { id } = useParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [wordCount, setWordCount] = useState(0)
  const [paragraphCount, setParagraphCount] = useState(0)
  const [preview, setPreview] = useState('')

  const [expectedRespondents, setExpectedRespondents] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('qualitative_analysis_sessions')
        .select('raw_transcript')
        .eq('id', id)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please upload your transcript again.')
        setLoading(false)
        return
      }

      const text: string = data.raw_transcript || ''
      const words = text.trim().split(/\s+/).filter(Boolean)
      const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

      setWordCount(words.length)
      setParagraphCount(paragraphs.length)
      setPreview(text.slice(0, 400))
      setLoading(false)
    }
    load()
  }, [id])

  const handleContinue = async () => {
    if (!expectedRespondents.trim()) {
      setErrorMsg('Please enter how many respondents or interviews are in this transcript.')
      return
    }
    if (!confirmed) {
      setErrorMsg('Please confirm this transcript looks correct before continuing.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const cross_checks = {
      wordCount,
      paragraphCount,
      expectedRespondents: Number(expectedRespondents)
    }

    const { error } = await supabase
      .from('qualitative_analysis_sessions')
      .update({ cross_checks, status: 'checked', updated_at: new Date().toISOString() })
      .eq('id', id)

    setSaving(false)

    if (error) {
      setErrorMsg('Something went wrong saving this step. Please try again.')
      return
    }

    router.push(`/qualitative-analysis/${id}/theming`)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #EEEEEE',
    fontSize: '13px', color: '#333333', marginBottom: '14px', boxSizing: 'border-box'
  }
  const labelStyle: React.CSSProperties = { color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Confirm Your Transcript</h1>
        <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
          Step 2 of 10 &mdash; Let's make sure your file uploaded correctly before we continue.
        </p>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>What we found</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#777777', fontSize: '13px' }}>Word count</span>
            <span style={{ color: '#333333', fontSize: '13px', fontWeight: 700 }}>{wordCount.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ color: '#777777', fontSize: '13px' }}>Paragraphs detected</span>
            <span style={{ color: '#333333', fontSize: '13px', fontWeight: 700 }}>{paragraphCount}</span>
          </div>
          <p style={{ color: '#777777', fontSize: '11px', marginBottom: '4px' }}>Preview:</p>
          <p style={{ color: '#555555', fontSize: '12px', backgroundColor: '#F9F9F9', borderRadius: '8px', padding: '10px', lineHeight: '1.5' }}>
            {preview}{preview.length >= 400 ? '...' : ''}
          </p>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <label style={labelStyle}>How many respondents or interviews are in this transcript?</label>
          <input style={inputStyle} type="number" value={expectedRespondents} onChange={(e) => setExpectedRespondents(e.target.value)} placeholder="e.g. 12" />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: '2px' }} />
            <span style={{ color: '#555555', fontSize: '12px' }}>I confirm this transcript uploaded correctly and is ready for analysis.</span>
          </label>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '14px', marginBottom: '16px' }}>
            <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={saving}
          style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
