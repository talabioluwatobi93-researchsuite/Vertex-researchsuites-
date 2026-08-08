'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type Assignment = { theme: string; quote: string; removed?: boolean }
type Theme = { name: string; description: string }

export default function CodeReviewPage() {
  const { id } = useParams()
  const router = useRouter()

  const [themes, setThemes] = useState<Theme[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    setErrorMsg('')

    const { data: session, error } = await supabase
      .from('qualitative_analysis_sessions')
      .select('themes, quote_assignments')
      .eq('id', id)
      .single()

    if (error || !session) {
      setErrorMsg('Could not load this session.')
      setLoading(false)
      return
    }

    setThemes(session.themes || [])

    if (session.quote_assignments) {
      setAssignments(session.quote_assignments)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/qualitative-analysis/assign-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id })
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not assign quotes to themes. Please try again.')
        setLoading(false)
        return
      }
      setAssignments(data.assignments)
    } catch (e) {
      setErrorMsg('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  function reassign(index: number, newTheme: string) {
    setAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, theme: newTheme } : a)))
  }

  function removeQuote(index: number) {
    setAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, removed: true } : a)))
  }

  function restoreQuote(index: number) {
    setAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, removed: false } : a)))
  }

  const handleContinue = async () => {
    if (!confirmed) {
      setErrorMsg('Please confirm you have reviewed these quote assignments before continuing.')
      return
    }

    const activeAssignments = assignments.filter((a) => !a.removed)
    if (activeAssignments.length === 0) {
      setErrorMsg('Please keep at least one quote assignment before continuing.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('qualitative_analysis_sessions')
      .update({
        quote_assignments: activeAssignments,
        status: 'coded',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    setSaving(false)

    if (error) {
      setErrorMsg('Something went wrong saving your review. Please try again.')
      return
    }

    router.push(`/qualitative-analysis/${id}/analysis-type`)
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>Matching quotes to your themes...</p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Review Your Coding</h1>
        <p style={{ color: '#777777', fontSize: '13px', marginBottom: '4px' }}>
          Step 4 of 10 &mdash; Every quote below was matched to a theme automatically.
        </p>
        <p style={{ color: '#C0392B', fontSize: '12px', fontWeight: 600, marginBottom: '20px' }}>
          Please review each one carefully &mdash; you can reassign or remove any quote that doesn't fit before continuing.
        </p>

        {errorMsg && (
          <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '14px', marginBottom: '16px' }}>
            <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        {assignments.length === 0 && !errorMsg && (
          <p style={{ color: '#777777', fontSize: '13px' }}>No quotes were found for your themes. Please go back and adjust your themes.</p>
        )}

        {assignments.map((a, i) => (
          <div
            key={i}
            style={{
              backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #EEEEEE',
              marginBottom: '12px', opacity: a.removed ? 0.5 : 1
            }}
          >
            <p style={{ color: '#333333', fontSize: '13px', fontStyle: 'italic', lineHeight: '1.6', marginBottom: '10px' }}>
              &ldquo;{a.quote}&rdquo;
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={a.theme}
                disabled={a.removed}
                onChange={(e) => reassign(i, e.target.value)}
                style={{ flex: 1, padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
              >
                {themes.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
              {a.removed ? (
                <button onClick={() => restoreQuote(i)} style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Restore</button>
              ) : (
                <button onClick={() => removeQuote(i)} style={{ background: 'none', border: 'none', color: '#C0392B', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
              )}
            </div>
          </div>
        ))}

        {assignments.length > 0 && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginTop: '8px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: '2px' }} />
              <span style={{ color: '#555555', fontSize: '12px' }}>
                I have reviewed these quote-to-theme assignments and they accurately represent my data.
              </span>
            </label>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={saving || assignments.length === 0}
          style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Confirm & Continue'}
        </button>
      </div>
    </div>
  )
}
