'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function CleaningPage() {
  const { id } = useParams()
  const router = useRouter()

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [missingConfig, setMissingConfig] = useState<any>({})
  const [duplicateInfo, setDuplicateInfo] = useState<any>({
    detected_count: 0,
    row_indexes: [],
    action: 'excluded'
  })
  const [scaleRange, setScaleRange] = useState<any>({ scaleMin: 1, scaleMax: 5 })

  useEffect(() => {
    loadSession()
  }, [id])

  async function loadSession() {
    setLoading(true)
    const { data, error } = await supabase
      .from('quantitative_analysis_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      setErrorMsg('Could not load session data.')
      setLoading(false)
      return
    }

    setSession(data)

    const existingConfig = data.cleaning_config || {}
    setScaleRange({
      scaleMin: existingConfig.scaleMin ?? 1,
      scaleMax: existingConfig.scaleMax ?? 5
    })

    const rawData: any[] = data.raw_data || []
    const constructs: any[] = data.constructs || []

    const missing: any = {}
    constructs.forEach((c: any) => {
      const cols: number[] = c.columnIndexes || []
      let count = 0
      rawData.forEach((row: any[]) => {
        const hasMissing = cols.some((ci) => {
          const val = row[ci]
          return val === null || val === undefined || String(val).trim() === ''
        })
        if (hasMissing) count++
      })
      missing[c.id] = { strategy: 'exclude_row', missing_count: count }
    })
    setMissingConfig(missing)

    const seen = new Map<string, number>()
    const dupIndexes: number[] = []
    rawData.forEach((row: any[], idx: number) => {
      const key = JSON.stringify(row)
      if (seen.has(key)) {
        dupIndexes.push(idx)
      } else {
        seen.set(key, idx)
      }
    })
    setDuplicateInfo({
      detected_count: dupIndexes.length,
      row_indexes: dupIndexes,
      action: 'excluded'
    })

    setLoading(false)
  }

  function updateStrategy(constructId: string, strategy: string) {
    setMissingConfig((prev: any) => ({
      ...prev,
      [constructId]: { ...prev[constructId], strategy }
    }))
  }

  function updateDuplicateAction(action: string) {
    setDuplicateInfo((prev: any) => ({ ...prev, action }))
  }

  async function handleContinue() {
    setSaving(true)
    setErrorMsg('')

    const cleaning_config = {
      scaleMin: scaleRange.scaleMin,
      scaleMax: scaleRange.scaleMax,
      missing_values: missingConfig,
      duplicates: duplicateInfo
    }

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({ cleaning_config, status: 'cleaning_complete' })
      .eq('id', id)

    setSaving(false)

    if (error) {
      setErrorMsg('Failed to save cleaning settings. Please try again.')
      return
    }

    router.push(`/quantitative-analysis/${id}/results`)
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#777777' }}>
        Loading data cleaning options...
      </div>
    )
  }

  const constructs: any[] = session?.constructs || []

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#333333', marginBottom: '4px' }}>
        Step 6: Data Cleaning
      </h1>
      <p style={{ fontSize: '13px', color: '#777777', marginBottom: '24px' }}>
        Review missing values and duplicate rows before analysis.
      </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>
          Missing Values
        </h2>

        {constructs.length === 0 && (
          <p style={{ fontSize: '13px', color: '#777777' }}>No constructs found for this session.</p>
        )}

        {constructs.map((c: any) => {
          const info = missingConfig[c.id] || { strategy: 'exclude_row', missing_count: 0 }
          return (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#333333', fontSize: '13px', fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: '#777777', fontSize: '12px' }}>
                  {info.missing_count} row{info.missing_count !== 1 ? 's' : ''} affected
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => updateStrategy(c.id, 'exclude_row')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: info.strategy === 'exclude_row' ? '1px solid #D4AF37' : '1px solid #EEEEEE',
                    backgroundColor: info.strategy === 'exclude_row' ? '#FFF8E7' : '#ffffff',
                    color: '#333333', cursor: 'pointer'
                  }}
                >
                  Exclude Row
                </button>
                <button
                  onClick={() => updateStrategy(c.id, 'exclude_item')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: info.strategy === 'exclude_item' ? '1px solid #D4AF37' : '1px solid #EEEEEE',
                    backgroundColor: info.strategy === 'exclude_item' ? '#FFF8E7' : '#ffffff',
                    color: '#333333', cursor: 'pointer'
                  }}
                >
                  Exclude Item Only
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>
          Duplicate Rows
        </h2>
        <p style={{ fontSize: '13px', color: '#333333', marginBottom: '12px' }}>
          {duplicateInfo.detected_count} duplicate row{duplicateInfo.detected_count !== 1 ? 's' : ''} detected.
        </p>
        {duplicateInfo.detected_count > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => updateDuplicateAction('excluded')}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                border: duplicateInfo.action === 'excluded' ? '1px solid #D4AF37' : '1px solid #EEEEEE',
                backgroundColor: duplicateInfo.action === 'excluded' ? '#FFF8E7' : '#ffffff',
                color: '#333333', cursor: 'pointer'
              }}
            >
              Exclude Duplicates
            </button>
            <button
              onClick={() => updateDuplicateAction('kept')}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                border: duplicateInfo.action === 'kept' ? '1px solid #D4AF37' : '1px solid #EEEEEE',
                backgroundColor: duplicateInfo.action === 'kept' ? '#FFF8E7' : '#ffffff',
                color: '#333333', cursor: 'pointer'
              }}
            >
              Keep Duplicates
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={saving}
        style={{
          width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none',
          borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
        }}
      >
        {saving ? 'Saving...' : 'Continue to Analysis Engine'}
      </button>
    </div>
  )
}
