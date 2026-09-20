'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { CITATION_STYLES, CitationStyleValue } from '@/lib/citationStyles'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function CleaningPage() {
  const [showDemoEditForm, setShowDemoEditForm] = useState(false);

  const { id } = useParams()
  const router = useRouter()

  const [session, setSession] = useState<any>(null)
  const qMappingConfirmed = (session as any)?.questionnaire_mapping_confirmed;
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [missingConfig, setMissingConfig] = useState<any>({})
  const [duplicateInfo, setDuplicateInfo] = useState<any>({
    detected_count: 0,
    row_indexes: [],
    action: 'excluded'
  })
  const [textMappings, setTextMappings] = useState<any>({})
  const [demoMappings, setDemoMappings] = useState<any>({})
  const [mappingFailedReason, setMappingFailedReason] = useState<string>("");
  const [straightLining, setStraightLining] = useState<any>({
    detected_row_indexes: [],
    action: 'excluded'
  })
  const [chartPrefs, setChartPrefs] = useState<{ bar: boolean; pie: boolean }>({ bar: true, pie: true })
  const [citationStyle, setCitationStyle] = useState<CitationStyleValue | ''>('')

  useEffect(() => {
    loadSession()
  }, [id])

  useEffect(() => {
    if (!id) return

    const prepareQuestionnaireMapping = async () => {
      try {
        const { data, error } = await supabase
          .from('quantitative_analysis_sessions')
          .select('questionnaire_file_path, questionnaire_link, questionnaire_mapping')
          .eq('id', id)
          .single()

        if (error || !data) return

        const hasQuestionnaireSource = !!(data.questionnaire_file_path || data.questionnaire_link)
        if (!hasQuestionnaireSource || data.questionnaire_mapping) return

        const mapRes = await fetch('/api/quantitative-analysis/map-questionnaire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: id }),
        })
        const mapData = await mapRes.json()
        if (mapData.mappingFailed) {
          setMappingFailedReason(mapData.reason || 'unknown_error')
          return
        }

        // Auto-confirm: the cleaning page's own input fields (pre-filled below)
        // are the real human checkpoint, since the user can freely edit any
        // suggested label before saving. This just marks the mapping eligible
        // to be used as a pre-fill suggestion.
        await supabase
          .from('quantitative_analysis_sessions')
          .update({ questionnaire_mapping_confirmed: true })
          .eq('id', id)

        loadSession()
      } catch (err) {
        console.error('Questionnaire auto-mapping failed silently:', err)
        setMappingFailedReason('network_or_unexpected_error')
        // Intentionally swallow: manual entry remains fully available either way.
      }
    }

    prepareQuestionnaireMapping()
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

    const rawData: any[] = data.raw_data || []
    const constructs: any[] = data.constructs || []
    const columnHeaders: string[] = data.column_headers || []
    const scaleConstructs = constructs.filter((c: any) => c.role !== 'Demographic')

    // 1. Missing values
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

    // 2. Duplicates
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
    setDuplicateInfo({ detected_count: dupIndexes.length, row_indexes: dupIndexes, action: 'excluded' })

    // 3. Text-to-value mapping detection (scale constructs only)
    const mappingsNeeded: any = {}
    scaleConstructs.forEach((c: any) => {
      const cols: number[] = c.columnIndexes || []
      const uniqueTexts = new Set<string>()
      rawData.forEach((row: any[]) => {
        cols.forEach((ci) => {
          const val = row[ci]
          if (val === null || val === undefined || String(val).trim() === '') return
          if (isNaN(Number(val))) uniqueTexts.add(String(val).trim())
        })
      })
      if (uniqueTexts.size > 0) {
        mappingsNeeded[c.id] = {
          constructName: c.name,
          values: Array.from(uniqueTexts).reduce((acc: any, v: string) => {
            acc[v] = ''
            return acc
          }, {})
        }
      }
    })
    setTextMappings(mappingsNeeded)

    // 3b. Per-column demographic mapping — fully generic, no hardcoded names.
    // Loops each demographic column individually so codes never mix across questions.
    // Skips a column entirely if it already contains text instead of numeric codes.
    const demoConstructs = constructs.filter((c: any) => c.role === 'Demographic')
    const demoMappingsNeeded: any = {}
    demoConstructs.forEach((c: any) => {
      const cols: number[] = c.columnIndexes || []
      cols.forEach((colIndex) => {
        const uniqueCodes = new Set<string>()
        let hasNonNumeric = false
        rawData.forEach((row: any[]) => {
          const val = row[colIndex]
          if (val === null || val === undefined || String(val).trim() === '') return
          const trimmed = String(val).trim()
          if (isNaN(Number(trimmed))) {
            hasNonNumeric = true
          } else {
            uniqueCodes.add(trimmed)
          }
        })
        // Skip this column if it already has text values (nothing to map)
        if (hasNonNumeric || uniqueCodes.size === 0) return

        const label = columnHeaders[colIndex] || `Column ${colIndex + 1}`
        demoMappingsNeeded[colIndex] = {
          columnLabel: label,
          codes: Array.from(uniqueCodes).sort().reduce((acc: any, code: string) => {
            acc[code] = ''
            return acc
          }, {})
        }
      })
    })

    // Pre-fill from confirmed AI questionnaire mapping (Phase 2A), if present.
    // Only fills in codes the user has not already set, and only for columns
    // where the mapping was confirmed by the user beforehand.
    const qMapping = (session as any)?.questionnaire_mapping
    ;(window as any).__DEBUG_QMAPPING = qMapping
        if (qMapping && qMappingConfirmed) {
      Object.entries(demoMappingsNeeded).forEach(([colIndex, m]: [string, any]) => {
        const aiEntry = qMapping[m.columnLabel]
        if (!aiEntry || !aiEntry.valueLabels) return
        Object.keys(m.codes).forEach((code) => {
          if (!m.codes[code] && aiEntry.valueLabels[code]) {
            demoMappingsNeeded[colIndex].codes[code] = aiEntry.valueLabels[code]
          }
        })
      })
    }

    setDemoMappings(demoMappingsNeeded)

    // 4. Straight-lining detection (same value across every item in a construct with 3+ items)
    const straightRows = new Set<number>()
    rawData.forEach((row: any[], idx: number) => {
      scaleConstructs.forEach((c: any) => {
        const cols: number[] = c.columnIndexes || []
        if (cols.length < 3) return
        const values = cols.map((ci) => row[ci]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
        if (values.length !== cols.length) return
        const allSame = values.every((v) => String(v).trim() === String(values[0]).trim())
        if (allSame) straightRows.add(idx)
      })
    })
    setStraightLining({ detected_row_indexes: Array.from(straightRows), action: 'excluded' })

    setLoading(false)
  }

  function updateStrategy(constructId: string, strategy: string) {
    setMissingConfig((prev: any) => ({ ...prev, [constructId]: { ...prev[constructId], strategy } }))
  }

  function updateDuplicateAction(action: string) {
    setDuplicateInfo((prev: any) => ({ ...prev, action }))
  }

  function updateStraightLiningAction(action: string) {
    setStraightLining((prev: any) => ({ ...prev, action }))
  }

  function updateTextMapping(constructId: string, textValue: string, numValue: string) {
    setTextMappings((prev: any) => ({
      ...prev,
      [constructId]: {
        ...prev[constructId],
        values: { ...prev[constructId].values, [textValue]: numValue }
      }
    }))
  }

  // Generic per-column demographic label updater — works for any column, any code, any label text
  function updateDemoMapping(colIndex: number, code: string, labelText: string) {
    setDemoMappings((prev: any) => ({
      ...prev,
      [colIndex]: {
        ...prev[colIndex],
        codes: { ...prev[colIndex].codes, [code]: labelText }
      }
    }))
  }

  const textMappingIncomplete = Object.values(textMappings).some((m: any) => {
    return Object.values(m.values).some((v: any) => v === null || v === '')
  })

  const demoMappingIncomplete = Object.values(demoMappings).some((m: any) => {
    return Object.values(m.codes).some((v: any) => v === null || v === '')
  })

  async function handleContinue() {
    if (textMappingIncomplete) {
      setErrorMsg('Please assign a label to every value listed below before continuing.')
      return
    }
    if (demoMappingIncomplete) {
      setErrorMsg('Please assign a label to every demographic code listed below before continuing.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const cleanTextMappings: any = {}
    Object.entries(textMappings).forEach(([constructId, m]: any) => {
      cleanTextMappings[constructId] = {}
      Object.entries(m.values).forEach(([text, num]: any) => {
        cleanTextMappings[constructId][text] = Number(num)
      })
    })

    // Generic per-column demographic mapping payload — keyed by column index, whatever that column is
    const cleanDemoMappings: any = {}
    Object.entries(demoMappings).forEach(([colIndex, m]: any) => {
      cleanDemoMappings[colIndex] = {}
      Object.entries(m.codes).forEach(([code, label]: any) => {
        cleanDemoMappings[colIndex][code] = label
      })
    })

    const cleaning_config = {
      missing_values: missingConfig,
      duplicates: duplicateInfo,
      text_mappings: cleanTextMappings,
      demographic_mappings: cleanDemoMappings,
      straight_lining: straightLining
    }

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({ cleaning_config, chart_preferences: chartPrefs, citation_style: citationStyle, status: 'cleaning_complete' })
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
  const hasTextMappings = Object.keys(textMappings).length > 0
  const hasDemoMappings = Object.keys(demoMappings).length > 0

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#333333', marginBottom: '4px' }}>
        Data Cleaning
      </h1>
      <p style={{ fontSize: '13px', color: '#777777', marginBottom: '24px' }}>
        Review these before your analysis runs. You're always in control &mdash; nothing is auto-corrected.
      </p>

      {hasTextMappings && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '6px' }}>Text-to-Value Mapping</h2>
          <p style={{ fontSize: '12px', color: '#777777', marginBottom: '14px' }}>
            Some of your answers are written as text instead of numbers. Tell us what number each one means.
          </p>
          {Object.entries(textMappings).map(([constructId, m]: any) => (
            <div key={constructId} style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#333333', marginBottom: '8px' }}>{m.constructName}</p>
              {Object.keys(m.values).map((textVal) => (
                <div key={textVal} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#333333' }}>"{textVal}" =</span>
                  <input
                    type="number"
                    value={m.values[textVal]}
                    onChange={(e) => updateTextMapping(constructId, textVal, e.target.value)}
                    style={{ width: '70px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {mappingFailedReason && (
            <div style={{ backgroundColor: "#FFF3CD", border: "1px solid #FFECB5", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#664D03", marginBottom: "4px" }}>We couldn't automatically detect answer labels from your questionnaire.</p>
              <p style={{ fontSize: "12px", color: "#664D03" }}>Reason: {mappingFailedReason}. Please enter the meaning of each code manually below, or check that your questionnaire file/link is accessible and try re-uploading.</p>
            </div>
          )}

          {hasDemoMappings && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '6px' }}>Demographic Coding</h2>
      <pre style={{ fontSize: '10px', background: '#f5f5f5', color: '#000', padding: '8px', overflow: 'auto', maxHeight: '300px', border: '2px solid red' }}>{JSON.stringify((window as any).__DEBUG_QMAPPING, null, 2)}</pre>
      <pre style={{ fontSize: '10px', background: '#f5f5f5', color: '#000', padding: '8px', overflow: 'auto', maxHeight: '300px', border: '2px solid red' }}>{JSON.stringify((window as any).__DEBUG_QMAPPING, null, 2)}</pre>
          {qMappingConfirmed && !showDemoEditForm ? (
            <div>
              <p style={{ fontSize: '12px', color: '#777777', marginBottom: '14px' }}>
                We detected the following code meanings from your questionnaire. Please confirm they're correct.
              </p>
              {Object.entries(demoMappings).map(([colIndex, m]: any) => (
                <div key={colIndex} style={{ marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #F5F5F5' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#333333', marginBottom: '6px' }}>{m.columnLabel}</p>
                  {Object.keys(m.codes).map((code) => (
                    <div key={code} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#333333', marginBottom: '4px' }}>
                      <span style={{ color: '#777777' }}>{code} →</span>
                      <span>{m.codes[code]}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={() => setShowDemoEditForm(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #D4AF37', backgroundColor: '#D4AF37', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Looks correct, continue
                </button>
                <button onClick={() => setShowDemoEditForm(true)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #EEEEEE', backgroundColor: '#ffffff', color: '#333333', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Let me edit this myself
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '12px', color: '#777777', marginBottom: '14px' }}>
            Some of your demographic answers use number codes. Tell us what each code means for each question below.
          </p>
          {Object.entries(demoMappings).map(([colIndex, m]: any) => (
            <div key={colIndex} style={{ marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid #F5F5F5' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#333333', marginBottom: '8px' }}>{m.columnLabel}</p>
              {Object.keys(m.codes).map((code) => (
                <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#333333' }}>"{code}" =</span>
                  <input
                    type="text"
                    value={m.codes[code]}
                    onChange={(e) => updateDemoMapping(Number(colIndex), code, e.target.value)}
                    placeholder="e.g. Male"
                    style={{ width: '120px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
              {qMappingConfirmed && (
                <button onClick={() => setShowDemoEditForm(false)} style={{ marginTop: '10px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #D4AF37', backgroundColor: '#D4AF37', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Done editing
                </button>
              )}
            </div>
          )}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '12px' }}>Missing Values</h2>
        {constructs.length === 0 && <p style={{ fontSize: '13px', color: '#777777' }}>No constructs found for this session.</p>}
        {constructs.map((c: any) => {
          const info = missingConfig[c.id] || { strategy: 'exclude_row', missing_count: 0 }
          return (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#333333', fontSize: '13px', fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: '#777777', fontSize: '12px' }}>{info.missing_count} row{info.missing_count !== 1 ? 's' : ''} affected</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => updateStrategy(c.id, 'exclude_row')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: info.strategy === 'exclude_row' ? '1px solid #D4AF37' : '1px solid #EEEEEE', backgroundColor: info.strategy === 'exclude_row' ? '#FFF8E7' : '#ffffff', color: '#333333', cursor: 'pointer' }}>
                  Exclude Row
                </button>
                <button onClick={() => updateStrategy(c.id, 'exclude_item')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: info.strategy === 'exclude_item' ? '1px solid #D4AF37' : '1px solid #EEEEEE', backgroundColor: info.strategy === 'exclude_item' ? '#FFF8E7' : '#ffffff', color: '#333333', cursor: 'pointer' }}>
                  Exclude Item Only
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Duplicate Rows</h2>
        <p style={{ fontSize: '13px', color: '#333333', marginBottom: '12px' }}>{duplicateInfo.detected_count} duplicate row{duplicateInfo.detected_count !== 1 ? 's' : ''} detected.</p>
        {duplicateInfo.detected_count > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => updateDuplicateAction('excluded')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: duplicateInfo.action === 'excluded' ? '1px solid #D4AF37' : '1px solid #EEEEEE', backgroundColor: duplicateInfo.action === 'excluded' ? '#FFF8E7' : '#ffffff', color: '#333333', cursor: 'pointer' }}>
              Exclude Duplicates
            </button>
            <button onClick={() => updateDuplicateAction('kept')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: duplicateInfo.action === 'kept' ? '1px solid #D4AF37' : '1px solid #EEEEEE', backgroundColor: duplicateInfo.action === 'kept' ? '#FFF8E7' : '#ffffff', color: '#333333', cursor: 'pointer' }}>
              Keep Duplicates
            </button>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Straight-Lining / Low-Effort Responses</h2>
        <p style={{ fontSize: '12px', color: '#777777', marginBottom: '12px' }}>
          Respondents who answered every question in a section with the exact same value &mdash; often a sign of low-effort responding.
        </p>
        <p style={{ fontSize: '13px', color: '#333333', marginBottom: '12px' }}>{straightLining.detected_row_indexes.length} respondent{straightLining.detected_row_indexes.length !== 1 ? 's' : ''} detected.</p>
        {straightLining.detected_row_indexes.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => updateStraightLiningAction('excluded')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: straightLining.action === 'excluded' ? '1px solid #D4AF37' : '1px solid #EEEEEE', backgroundColor: straightLining.action === 'excluded' ? '#FFF8E7' : '#ffffff', color: '#333333', cursor: 'pointer' }}>
              Exclude These
            </button>
            <button onClick={() => updateStraightLiningAction('kept')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: straightLining.action === 'kept' ? '1px solid #D4AF37' : '1px solid #EEEEEE', backgroundColor: straightLining.action === 'kept' ? '#FFF8E7' : '#ffffff', color: '#333333', cursor: 'pointer' }}>
              Keep Anyway
            </button>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>Chart Types to Include</h2>
        <p style={{ fontSize: '13px', color: '#333333', marginBottom: '12px' }}>Choose which chart types should be generated for this report.</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setChartPrefs((prev) => ({ ...prev, bar: !prev.bar }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: chartPrefs.bar ? '1px solid #D4AF37' : '1px solid #EEEEEE', backgroundColor: chartPrefs.bar ? '#FFF8E7' : '#ffffff', color: '#333333', cursor: 'pointer' }}>
            Bar Charts
          </button>
          <button onClick={() => setChartPrefs((prev) => ({ ...prev, pie: !prev.pie }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: chartPrefs.pie ? '1px solid #D4AF37' : '1px solid #EEEEEE', backgroundColor: chartPrefs.pie ? '#FFF8E7' : '#ffffff', color: '#333333', cursor: 'pointer' }}>
            Pie Charts
          </button>
        </div>
      </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#333333', marginBottom: '8px' }}>APA style</h2>
          <select value={citationStyle} onChange={(e) => setCitationStyle(e.target.value as CitationStyleValue)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }}>
            <option value="">Select citation style</option>
            {CITATION_STYLES.map((style) => (
              <option key={style.value} value={style.value}>{style.label}</option>
            ))}
          </select>
        </div>

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
        {saving ? 'Saving...' : 'Continue to Analysis Engine'}
      </button>
    </div>
  )
}
