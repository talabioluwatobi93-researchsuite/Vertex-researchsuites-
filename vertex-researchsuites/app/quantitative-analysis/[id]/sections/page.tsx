'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type Construct = {
  id: string
  name: string
  role: 'IV' | 'DV' | 'Demographic'
  columnIndexes: number[]
  reverseIndexes: number[]
}

type Section = {
  role: 'Demographic' | 'IV' | 'DV'
  title: string
  constructIds: string[]
}

const DEFAULT_TITLES: Record<Section['role'], string> = {
  Demographic: 'Section A: Demographic Profile',
  IV: 'Section B: Independent Variable(s)',
  DV: 'Section C: Dependent Variable(s)',
}

export default function SectionsPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [constructs, setConstructs] = useState<Construct[]>([])
  const [sections, setSections] = useState<Section[]>([])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('quantitative_analysis_sessions')
        .select('constructs, sections')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please go back and complete the previous steps first.')
        setLoading(false)
        return
      }

      const loadedConstructs: Construct[] = data.constructs || []
      setConstructs(loadedConstructs)

      if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        setSections(data.sections)
      } else {
        const roles: Section['role'][] = ['Demographic', 'IV', 'DV']
        const built: Section[] = roles
          .map((role) => ({
            role,
            title: DEFAULT_TITLES[role],
            constructIds: loadedConstructs.filter((c) => c.role === role).map((c) => c.id),
          }))
          .filter((s) => s.constructIds.length > 0)
        setSections(built)
      }

      setLoading(false)
    }
    load()
  }, [sessionId])

  const updateTitle = (role: Section['role'], newTitle: string) => {
    setSections((prev) =>
      prev.map((s) => (s.role === role ? { ...s, title: newTitle } : s))
    )
  }

  const getConstruct = (id: string) => constructs.find((c) => c.id === id)

  const handleContinue = async () => {
    if (sections.length === 0) {
      setErrorMsg('No sections found. Please go back and check your construct tagging.')
      return
    }

    const emptyTitle = sections.find((s) => !s.title.trim())
    if (emptyTitle) {
      setErrorMsg('Every section needs a title.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({
        sections: sections,
        status: 'sections_mapped',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg('Something went wrong saving your sections. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/cleaning`)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F9F9F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9F9F9', padding: '24px 16px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
          Organize Your Sections
        </h1>
        <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
          Your constructs are grouped below by type. Rename each section title if you'd like — this is how they'll appear in your final report.
        </p>

        {sections.map((section) => (
          <div
            key={section.role}
            style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '14px' }}
          >
            <input
              value={section.title}
              onChange={(e) => updateTitle(section.role, e.target.value)}
              style={{ width: '100%', fontSize: '14px', fontWeight: 700, color: '#333333', border: '1px solid #EEEEEE', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}
            />

            {section.constructIds.map((id) => {
              const construct = getConstruct(id)
              if (!construct) return null
              return (
                <div
                  key={id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F0F0F0' }}
                >
                  <span style={{ color: '#333333', fontSize: '13px' }}>{construct.name}</span>
                  <span style={{ color: '#777777', fontSize: '11px' }}>{construct.columnIndexes.length} item{construct.columnIndexes.length !== 1 ? 's' : ''}</span>
                </div>
              )
            })}
          </div>
        ))}

        {errorMsg && (
          <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={saving}
          style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Continue to Data Cleaning'}
        </button>
      </div>
    </div>
  )
}
