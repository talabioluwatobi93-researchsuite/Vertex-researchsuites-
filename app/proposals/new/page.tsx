'use client'

import { useState } from 'react'

export default function NewProposal() {
  const [institution, setInstitution] = useState('')
  const [course, setCourse] = useState('')
  const [department, setDepartment] = useState('')
  const [sequence, setSequence] = useState('')
  const [loading, setLoading] = useState(false)
  const [topics, setTopics] = useState('')

  const handleGenerate = async () => {
    if (!institution || !course || !department) return
    setLoading(true)
    setTopics('')

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

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
        Get Research Topics & Proposals
      </h1>

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
            onClick={handleGenerate}
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
            {loading ? 'Generating your topics...' : 'Generate 5 Topics'}
          </button>
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
    </div>
  )
}
