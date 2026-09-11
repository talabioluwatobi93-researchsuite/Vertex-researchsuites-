'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function QualitativeUploadPage() {
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [topic, setTopic] = useState('')
  const [researchQuestions, setResearchQuestions] = useState('')
  const [objectives, setObjectives] = useState('')
  const [apaVersion, setApaVersion] = useState('7th edition')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileName(f.name)
    setErrorMsg('')
  }

  async function extractText(): Promise<string | null> {
    if (!file) return null

    if (file.name.toLowerCase().endsWith('.txt')) {
      return await file.text()
    }

    if (file.name.toLowerCase().endsWith('.docx')) {
      setExtracting(true)
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/qualitative-analysis/parse-docx', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      setExtracting(false)
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not read this .docx file.')
        return null
      }
      return data.text
    }

    setErrorMsg('Please upload a .txt or .docx file.')
    return null
  }

  const handleSubmit = async () => {
    if (!file) {
      setErrorMsg('Please upload your transcript file first.')
      return
    }
    if (!topic.trim() || !researchQuestions.trim() || !objectives.trim()) {
      setErrorMsg('Please fill in your Topic, Research Questions, and Objectives.')
      return
    }

    setErrorMsg('')
    const transcriptText = await extractText()
    if (!transcriptText) return

    if (transcriptText.trim().length < 50) {
      setErrorMsg('This transcript looks too short. Please check your file and try again.')
      return
    }

    setSaving(true)

    const { data: userData } = await supabase.auth.getUser()

    const research_framework = {
      topic: topic.trim(),
      researchQuestions: researchQuestions.split('\n').map((s) => s.trim()).filter(Boolean),
      objectives: objectives.split('\n').map((s) => s.trim()).filter(Boolean),
      apaVersion
    }

    const { data, error } = await supabase
      .from('qualitative_analysis_sessions')
      .insert({
        user_id: userData?.user?.id,
        status: 'uploaded',
        file_name: fileName,
        raw_transcript: transcriptText,
        research_framework
      })
      .select('id')
      .single()

    setSaving(false)

    if (error || !data) {
      setErrorMsg('Something went wrong saving your submission. Please try again.')
      return
    }

    router.push(`/qualitative-analysis/${data.id}/review`)
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
    fontFamily: 'inherit'
  }

  const labelStyle: React.CSSProperties = {
    color: '#333333',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '6px',
    display: 'block'
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
          Qualitative Data Analysis
        </h1>
        <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
          Step 1 of 10 &mdash; Upload your transcript and tell us about your study.
        </p>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <label style={labelStyle}>Upload Transcript (.txt or .docx)</label>
          <input type="file" accept=".txt,.docx" onChange={handleFileChange} style={{ fontSize: '13px', marginBottom: '8px' }} />
          {fileName && <p style={{ color: '#777777', fontSize: '12px', margin: 0 }}>Selected: {fileName}</p>}
          {extracting && <p style={{ color: '#D4AF37', fontSize: '12px', marginTop: '8px' }}>Reading your document...</p>}
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <label style={labelStyle}>Research Topic</label>
          <input style={inputStyle} type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Perceptions of Social Media Influencer Marketing" />

          <label style={labelStyle}>Research Questions (one per line)</label>
          <textarea style={{ ...inputStyle, minHeight: '80px' }} value={researchQuestions} onChange={(e) => setResearchQuestions(e.target.value)} placeholder={"RQ1: ...\nRQ2: ..."} />

          <label style={labelStyle}>Objectives (one per line)</label>
          <textarea style={{ ...inputStyle, minHeight: '80px' }} value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder={"To explore...\nTo examine..."} />

          <label style={labelStyle}>APA Version</label>
          <select style={inputStyle} value={apaVersion} onChange={(e) => setApaVersion(e.target.value)}>
            <option value="7th edition">APA 7th edition</option>
            <option value="6th edition">APA 6th edition</option>
          </select>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || extracting}
          style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : extracting ? 'Reading file...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
