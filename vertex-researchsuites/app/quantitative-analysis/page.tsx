'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { CITATION_STYLES } from '@/lib/citationStyles'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function QuantitativeAnalysisUploadPage() {
  const router = useRouter()
  const [fileName, setFileName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [topic, setTopic] = useState('')
  const [researchQuestions, setResearchQuestions] = useState('')
  const [hypotheses, setHypotheses] = useState('')
  const [objectives, setObjectives] = useState('')
  const [apaVersion, setApaVersion] = useState('APA7')

  // Phase 1: Questionnaire (Box 1) and Chapter 3 (Box 2) inputs
  const [questionnaireLink, setQuestionnaireLink] = useState('');
  const [questionnaireFile, setQuestionnaireFile] = useState<File | null>(null);
  const [chapter3Link, setChapter3Link] = useState('');
  const [chapter3File, setChapter3File] = useState<File | null>(null);
  const [analysisIntent, setAnalysisIntent] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const validTypes = ['.xlsx', '.xls', '.csv']
    const isValid = validTypes.some((ext) => f.name.toLowerCase().endsWith(ext))
    if (!isValid) {
      setErrorMsg('Please upload a .xlsx, .xls, or .csv file.')
      return
    }
    setFile(f)
    setFileName(f.name)
    setErrorMsg('')
  }

  const handleSubmit = async () => {
    if (!file) {
      setErrorMsg('Please choose your data file first.')
      return
    }
    if (!topic.trim()) {
      setErrorMsg('Please enter your research topic.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErrorMsg('You need to be logged in to continue.')
        setLoading(false)
        return
      }

      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const fileFingerprint = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[firstSheetName]
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

      if (!rows || rows.length < 2) {
        setErrorMsg('This file looks empty or has no data rows. Please check your file and try again.')
        setLoading(false)
        return
      }

      const columnHeaders = rows[0]
      const dataRows = rows.slice(1)

      const researchFramework = {
        topic: topic.trim(),
        researchQuestions: researchQuestions.trim(),
        hypotheses: hypotheses.trim(),
        objectives: objectives.trim(),
        apaVersion,
      }

      const { data: session, error } = await supabase
        .from('quantitative_analysis_sessions')
        .insert({
          user_id: user.id,
          status: 'uploaded',
          file_name: file.name,
          column_headers: columnHeaders,
          raw_data: dataRows,
          research_framework: researchFramework,
          file_fingerprint: fileFingerprint,
        })
        .select('id')
        .single()

      if (error || !session) {
        setErrorMsg('Something went wrong saving your file. Please try again.')
        setLoading(false)
        return
      }

      router.push(`/quantitative-analysis/${session.id}/response-rate`)
    } catch (err) {
      setErrorMsg('This file could not be read. Please check the format and try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #EEEEEE',
    fontSize: '13px',
    color: '#333333',
    marginBottom: '14px',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    color: '#333333',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '6px',
    display: 'block',
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
        Quantitative Data Analysis
      </h1>
      <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
        Step 1 of 10 &mdash; Upload your data and tell us about your research.
      </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px', textAlign: 'center' }}>
        <label
          htmlFor="quant-upload"
          style={{
            display: 'inline-block',
            backgroundColor: '#D4AF37',
            color: '#333333',
            fontWeight: 700,
            fontSize: '13px',
            padding: '10px 20px',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          Choose Data File
        </label>
        <input
          id="quant-upload"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        {fileName && (
          <p style={{ color: '#777777', fontSize: '12px', marginTop: '10px' }}>{fileName}</p>
        )}
      </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: "1px solid #EEEEEE", marginBottom: "16px" }}>
            <p style={{ color: "#333333", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Questionnaire (required)</p>
            <p style={{ color: "#777777", fontSize: "12px", marginBottom: "10px" }}>Paste a link OR upload the survey instrument (PDF or Word).</p>
            <input
              style={inputStyle}
              value={questionnaireLink}
              onChange={(e) => setQuestionnaireLink(e.target.value)}
              placeholder="Paste a link to your questionnaire"
            />
            <div style={{ textAlign: "center", color: "#AAAAAA", fontSize: "12px", margin: "8px 0" }}>OR</div>
            <label
              htmlFor="questionnaire-upload"
              style={{
                display: "inline-block",
                backgroundColor: "#D4AF37",
                color: "#333333",
                fontWeight: 700,
                fontSize: "13px",
                padding: "10px 20px",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              Upload Questionnaire
            </label>
            <input
              id="questionnaire-upload"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setQuestionnaireFile(e.target.files ? e.target.files[0] : null)}
              style={{ display: "none" }}
            />
            {questionnaireFile && (
              <p style={{ color: "#777777", fontSize: "12px", marginTop: "10px" }}>{questionnaireFile.name}</p>
            )}
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: "1px solid #EEEEEE", marginBottom: "16px" }}>
            <p style={{ color: "#333333", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Chapter 3 (Methodology) - optional</p>
            <p style={{ color: "#777777", fontSize: "12px", marginBottom: "10px" }}>Paste a link OR upload just the Methodology chapter (PDF or Word).</p>
            <input
              style={inputStyle}
              value={chapter3Link}
              onChange={(e) => setChapter3Link(e.target.value)}
              placeholder="Paste a link to your Chapter 3"
            />
            <div style={{ textAlign: "center", color: "#AAAAAA", fontSize: "12px", margin: "8px 0" }}>OR</div>
            <label
              htmlFor="chapter3-upload"
              style={{
                display: "inline-block",
                backgroundColor: "#D4AF37",
                color: "#333333",
                fontWeight: 700,
                fontSize: "13px",
                padding: "10px 20px",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              Upload Chapter 3
            </label>
            <input
              id="chapter3-upload"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setChapter3File(e.target.files ? e.target.files[0] : null)}
              style={{ display: "none" }}
            />
            {chapter3File && (
              <p style={{ color: "#777777", fontSize: "12px", marginTop: "10px" }}>{chapter3File.name}</p>
            )}
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: "1px solid #EEEEEE", marginBottom: "16px" }}>
            <p style={{ color: "#333333", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>What do you want to analyze?</p>
            <textarea
              style={{ ...inputStyle, minHeight: "70px" }}
              value={analysisIntent}
              onChange={(e) => setAnalysisIntent(e.target.value)}
              placeholder="Describe in plain language what you want this analysis to cover"
            />
          </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Research Framework</p>

        <label style={labelStyle}>Research Topic</label>
        <input style={inputStyle} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Influencer Credibility and Purchase Intention" />

        <label style={labelStyle}>Research Questions</label>
        <textarea style={{ ...inputStyle, minHeight: '70px' }} value={researchQuestions} onChange={(e) => setResearchQuestions(e.target.value)} placeholder="One per line" />

        <label style={labelStyle}>Hypotheses</label>
        <textarea style={{ ...inputStyle, minHeight: '70px' }} value={hypotheses} onChange={(e) => setHypotheses(e.target.value)} placeholder="One per line" />

        <label style={labelStyle}>Objectives</label>
        <textarea style={{ ...inputStyle, minHeight: '70px' }} value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="One per line" />

        <label style={labelStyle}>Citation Style</label>
        <select style={inputStyle} value={apaVersion} onChange={(e) => setApaVersion(e.target.value)}>
          {CITATION_STYLES.map((style) => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
      >
        {loading ? 'Processing...' : 'Continue'}
      </button>
    </div>
  )
}
