'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type Theme = { name: string; description: string }

export default function ThemingPage() {
  const { id } = useParams()
  const router = useRouter()

  const [mode, setMode] = useState<'choose' | 'manual' | 'ai'>('choose')
  const [themes, setThemes] = useState<Theme[]>([])
  const [newThemeName, setNewThemeName] = useState('')
  const [newThemeDesc, setNewThemeDesc] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const addManualTheme = () => {
    const name = newThemeName.trim()
    if (!name) return
    setThemes([...themes, { name, description: newThemeDesc.trim() }])
    setNewThemeName('')
    setNewThemeDesc('')
  }

  const removeTheme = (index: number) => {
    setThemes(themes.filter((_, i) => i !== index))
  }

  const requestSuggestions = async () => {
    setMode('ai')
    setSuggesting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/qualitative-analysis/suggest-themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id })
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not suggest themes. Please try again or add your own.')
        setSuggesting(false)
        return
      }
      setThemes(data.themes)
    } catch (e) {
      setErrorMsg('Something went wrong. Please try again or add your own themes.')
    }
    setSuggesting(false)
  }

  const handleContinue = async () => {
    if (themes.length === 0) {
      setErrorMsg('Please add at least one theme before continuing.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('qualitative_analysis_sessions')
      .update({ themes, status: 'themed', updated_at: new Date().toISOString() })
      .eq('id', id)

    setSaving(false)

    if (error) {
      setErrorMsg('Something went wrong saving your themes. Please try again.')
      return
    }

    router.push(`/qualitative-analysis/${id}/code-review`)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #EEEEEE',
    fontSize: '13px', color: '#333333', boxSizing: 'border-box', fontFamily: 'inherit'
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Identify Your Themes</h1>
        <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
          Step 3 of 10 &mdash; Name the themes you see in your transcript, or let us suggest some.
        </p>

        {mode === 'choose' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
            <p style={{ color: '#333333', fontSize: '13px', marginBottom: '16px' }}>Do you already know the themes in your data?</p>
            <button
              onClick={() => setMode('manual')}
              style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px' }}
            >
              Yes, I'll name them myself
            </button>
            <button
              onClick={requestSuggestions}
              style={{ width: '100%', backgroundColor: '#F9F9F9', color: '#333333', border: '1px solid #D4AF37', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              No, suggest themes for me
            </button>
          </div>
        )}

        {mode === 'ai' && suggesting && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: '#777777', fontSize: '14px' }}>Reading your transcript for candidate themes...</p>
          </div>
        )}

        {(mode === 'manual' || (mode === 'ai' && !suggesting)) && (
          <>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
              <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
                {mode === 'ai' ? 'Suggested themes — edit, remove, or add your own' : 'Add your themes'}
              </p>
              {mode === 'manual' && (
                <div style={{ marginBottom: '12px' }}>
                  <input
                    style={{ ...inputStyle, marginBottom: '8px' }}
                    type="text"
                    placeholder="Theme name, e.g. Trust in Influencers"
                    value={newThemeName}
                    onChange={(e) => setNewThemeName(e.target.value)}
                  />
                  <input
                    style={{ ...inputStyle, marginBottom: '8px' }}
                    type="text"
                    placeholder="Short description (optional)"
                    value={newThemeDesc}
                    onChange={(e) => setNewThemeDesc(e.target.value)}
                  />
                  <button
                    onClick={addManualTheme}
                    style={{ backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Add Theme
                  </button>
                </div>
              )}

              {themes.map((t, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, margin: 0 }}>{t.name}</p>
                    {t.description && <p style={{ color: '#777777', fontSize: '12px', margin: '4px 0 0' }}>{t.description}</p>}
                  </div>
                  <button onClick={() => removeTheme(i)} style={{ background: 'none', border: 'none', color: '#C0392B', fontSize: '12px', cursor: 'pointer' }}>Remove</button>
                </div>
              ))}
              {themes.length === 0 && <p style={{ color: '#777777', fontSize: '12px' }}>No themes added yet.</p>}
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
              {saving ? 'Saving...' : 'Continue to Quote Assignment'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
