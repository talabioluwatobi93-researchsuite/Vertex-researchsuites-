'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type BunkerItem = {
  id: string
  item_name: string
  item_type: string
  content_reference: string
  purchased_at: string
  is_read: boolean
}

function reliabilityLabel(alpha: number): { label: string; color: string } {
  if (alpha >= 0.9) return { label: 'Excellent', color: '#2E7D32' }
  if (alpha >= 0.8) return { label: 'Good', color: '#558B2F' }
  if (alpha >= 0.7) return { label: 'Acceptable', color: '#D4AF37' }
  if (alpha >= 0.6) return { label: 'Questionable', color: '#E67E22' }
  return { label: 'Poor', color: '#C0392B' }
}

export default function Bunker() {
  const [items, setItems] = useState<BunkerItem[]>([])
  const [selected, setSelected] = useState<BunkerItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [pilotResults, setPilotResults] = useState<any>(null)
  const [pilotInterpretations, setPilotInterpretations] = useState<any>(null)
  const [genericJson, setGenericJson] = useState<any>(null)

  useEffect(() => {
    const fetchItems = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('bunker_items')
        .select('id, item_name, item_type, content_reference, purchased_at, is_read')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false })

      if (error) {
        console.error('Bunker fetchItems error:', error.message, error.details, error.hint)
      }
      if (data) setItems(data as BunkerItem[])
      setLoading(false)
    }

    fetchItems()
  }, [])

  async function openItem(item: BunkerItem) {
    setSelected(item)
    setDetailError('')
    setPilotResults(null)
    setPilotInterpretations(null)
    setGenericJson(null)

    if (!item.is_read) {
      await supabase.from('bunker_items').update({ is_read: true }).eq('id', item.id)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)))
    }

    if (item.item_type === 'pilot_study') {
      setDetailLoading(true)
      const { data, error } = await supabase
        .from('pilot_study_sessions')
        .select('results, interpretation')
        .eq('id', item.content_reference)
        .single()

      if (error || !data) {
        setDetailError('Could not load this result. The session may have been removed.')
      } else {
        setPilotResults(data.results)
        setPilotInterpretations(data.interpretation)
      }
      setDetailLoading(false)
      return
    }

    if (item.item_type === 'quantitative_analysis_dataset' || item.item_type === 'quantitative_analysis_report') {
      setDetailLoading(true)
      const { data, error } = await supabase
        .from('quantitative_analysis_sessions')
        .select('results, interpretation')
        .eq('id', item.content_reference)
        .single()

      if (error || !data) {
        setDetailError('Could not load this result. The session may have been removed.')
      } else {
        setGenericJson(item.item_type === 'quantitative_analysis_report' && data.interpretation ? data.interpretation : data.results)
      }
      setDetailLoading(false)
      return
    }

    if (item.item_type === 'qualitative_analysis_dataset' || item.item_type === 'qualitative_analysis_report') {
      setDetailLoading(true)
      const { data, error } = await supabase
        .from('qualitative_analysis_sessions')
        .select('results')
        .eq('id', item.content_reference)
        .single()

      if (error || !data) {
        setDetailError('Could not load this result. The session may have been removed.')
      } else {
        setGenericJson(data.results)
      }
      setDetailLoading(false)
      return
    }
  }

  if (selected) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
        <button
          onClick={() => setSelected(null)}
          style={{ backgroundColor: 'transparent', border: 'none', color: '#B8860B', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px', padding: 0 }}
        >
          ← Back to Bunker
        </button>
        <h1 style={{ color: '#333333', fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
          {selected.item_name}
        </h1>

        {selected.item_type === 'pilot_study' ? (
          <>
            {detailLoading && (
              <p style={{ color: '#888888', fontSize: '14px' }}>Loading your results...</p>
            )}
            {detailError && (
              <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '20px' }}>
                <p style={{ color: '#C0392B', fontSize: '14px', margin: 0 }}>{detailError}</p>
              </div>
            )}
            {pilotResults && (
              <>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #EEEEEE', overflow: 'hidden', marginBottom: '16px' }}>
                  <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, fontStyle: 'italic', padding: '14px 16px 0' }}>Table 1</p>
                  <p style={{ color: '#333333', fontSize: '13px', fontStyle: 'italic', padding: '2px 16px 12px' }}>Reliability Statistics (Cronbach's Alpha) by Construct</p>
                  <div style={{ display: 'flex', backgroundColor: '#F9F9F9', padding: '10px 16px', borderTop: '1px solid #333333', borderBottom: '1px solid #333333' }}>
                    <span style={{ flex: 2, fontSize: '11px', fontWeight: 700, color: '#333333' }}>Construct</span>
                    <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#333333', textAlign: 'center' }}>Items (k)</span>
                    <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#333333', textAlign: 'center' }}>n</span>
                    <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#333333', textAlign: 'center' }}>Alpha</span>
                  </div>
                  {(pilotResults.constructs || []).map((c: any, idx: number) => {
                    const rel = c.error ? null : reliabilityLabel(c.alpha)
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F0F0F0' }}>
                        <span style={{ flex: 2, fontSize: '13px', color: '#333333' }}>{c.name}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#333333', textAlign: 'center' }}>{c.k}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#333333', textAlign: 'center' }}>{c.n}</span>
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
                  {pilotResults.combined && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', backgroundColor: '#F9F9F9', borderTop: '1px solid #333333' }}>
                      <span style={{ flex: 2, fontSize: '13px', fontWeight: 700, color: '#333333' }}>Total (Combined)</span>
                      <span style={{ flex: 1, fontSize: '13px', color: '#333333', textAlign: 'center' }}>{pilotResults.combined.k}</span>
                      <span style={{ flex: 1, fontSize: '13px', color: '#333333', textAlign: 'center' }}>{pilotResults.combined.n}</span>
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: reliabilityLabel(pilotResults.combined.alpha).color, textAlign: 'center' }}>
                        {pilotResults.combined.alpha.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {pilotInterpretations?.reliability && (
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px', border: '1px solid #EEEEEE', marginBottom: '24px' }}>
                    <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Interpretation</p>
                    <p style={{ color: '#555555', fontSize: '13px', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{pilotInterpretations.reliability}</p>
                  </div>
                )}

                {pilotResults.demographics && pilotResults.demographics.tables.length > 0 && (
                  <>
                    {pilotResults.demographics.tables.map((t: any, ti: number) => (
                      <div key={ti} style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #EEEEEE', overflow: 'hidden', marginBottom: '10px' }}>
                        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, fontStyle: 'italic', padding: '14px 16px 0' }}>Table 2{ti > 0 ? `.${ti + 1}` : ''}</p>
                        <p style={{ color: '#333333', fontSize: '13px', fontStyle: 'italic', padding: '2px 16px 12px' }}>Frequency Distribution of {t.name}</p>
                        <div style={{ display: 'flex', backgroundColor: '#F9F9F9', padding: '10px 16px', borderTop: '1px solid #333333', borderBottom: '1px solid #333333' }}>
                          <span style={{ flex: 2, fontSize: '11px', fontWeight: 700, color: '#333333' }}>{t.name}</span>
                          <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#333333', textAlign: 'center' }}>Frequency</span>
                          <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#333333', textAlign: 'center' }}>Valid %</span>
                        </div>
                        {t.rows.map((r: any, ri: number) => (
                          <div key={ri} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #F0F0F0' }}>
                            <span style={{ flex: 2, fontSize: '13px', color: '#333333' }}>{r.label}</span>
                            <span style={{ flex: 1, fontSize: '13px', color: '#333333', textAlign: 'center' }}>{r.frequency}</span>
                            <span style={{ flex: 1, fontSize: '13px', color: '#333333', textAlign: 'center' }}>{r.validPercent}%</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {pilotInterpretations?.demographics && (
                      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
                        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Interpretation</p>
                        <p style={{ color: '#555555', fontSize: '13px', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{pilotInterpretations.demographics}</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        ) : selected.item_type && selected.item_type.startsWith('quantitative_analysis') || (selected.item_type && selected.item_type.startsWith('qualitative_analysis')) ? (
          <>
            {detailLoading && <p style={{ color: '#888888', fontSize: '14px' }}>Loading your results...</p>}
            {detailError && (
              <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '20px' }}>
                <p style={{ color: '#C0392B', fontSize: '14px', margin: 0 }}>{detailError}</p>
              </div>
            )}
            {genericJson && (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '13px', color: '#333333', lineHeight: '1.6', margin: 0 }}>
                  {typeof genericJson === 'string' ? genericJson : JSON.stringify(genericJson, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE' }}>
            <p style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: 0 }}>
              {selected.content_reference}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>
        🗄️My Bunker
      </h1>

      {loading ? (
        <p style={{ color: '#888888', fontSize: '14px' }}>Loading...</p>
      ) : items.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px 20px', border: '1px solid #EEEEEE', textAlign: 'center' }}>
          <p style={{ color: '#888888', fontSize: '14px', margin: 0 }}>Your Bunker is empty. Generate some research topics and save them here!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              style={{
                backgroundColor: '#ffffff',
                border: item.is_read ? '1px solid #EEEEEE' : '1px solid #D4AF37',
                borderRadius: '14px',
                padding: '16px 18px',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {!item.is_read && (
                <span
                  style={{
                    width: 8, height: 8, minWidth: 8, borderRadius: '50%',
                    backgroundColor: '#D4AF37', display: 'inline-block',
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ color: '#333333', fontSize: '14px', fontWeight: item.is_read ? 400 : 700, margin: 0 }}>
                  {item.item_name}
                </p>
                <p style={{ color: '#888888', fontSize: '12px', margin: '4px 0 0' }}>
                  {new Date(item.purchased_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
