'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const labelStyle = { color: '#333333', fontWeight: 'bold' as const, display: 'block', marginBottom: '5px' }
const inputStyle = { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #D4AF37', background: '#ffffff', color: '#333333', boxSizing: 'border-box' as const }

export default function SignUp() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [type, setType] = useState('')
  const [institution, setInstitution] = useState('')
  const [region, setRegion] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSignUp() {
    if (busy) return
    const cleanName = name.trim()
    const cleanEmail = email.trim()
    if (!cleanName || !cleanEmail || !password || !type) {
      setIsError(true)
      setMessage('Please fill in your full name, email, password and who you are.')
      return
    }
    if (password.length < 6) {
      setIsError(true)
      setMessage('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    const meta: Record<string, string> = { full_name: cleanName, account_type: type }
    meta.ref_code = new URLSearchParams(window.location.search).get('ref') || ''
    if (institution.trim()) meta.institution = institution.trim()
    if (region.trim()) meta.state = region.trim()
    const { error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: meta } })
    setBusy(false)
    if (error) {
      setIsError(true)
      setMessage(error.message)
    } else {
      setIsError(false)
      setMessage('Account created! Check your email.')
      setPassword('')
    }
  }

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', fontFamily: 'Arial', padding: '20px' }}>
      <div style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '40px' }}>
        <h1 style={{ color: '#D4AF37', textAlign: 'center', fontSize: '24px' }}>Vertex ResearchSuite</h1>
        <p style={{ color: '#333333', textAlign: 'center', marginBottom: '20px' }}>Create your account</p>
        {message && <p style={{ color: isError ? 'red' : 'green', textAlign: 'center' }}>{message}</p>}
        <label style={labelStyle}>Full Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name" style={inputStyle} />
        <label style={labelStyle}>Email Address</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" style={inputStyle} />
        <label style={labelStyle}>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" style={inputStyle} />
        <label style={labelStyle}>I am a...</label>
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}>
          <option value="">Select one</option>
          <option value="student">Student</option>
          <option value="researcher">Researcher / Academic</option>
          <option value="professional">Practitioner</option>
          <option value="institution">Institution / Organisation</option>
          <option value="business">Marketing / Business</option>
          <option value="other">Other</option>
        </select>
        <label style={labelStyle}>Institution / Organisation (optional)</label>
        <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Where you study or work" style={inputStyle} />
        <label style={labelStyle}>State / Country (optional)</label>
        <input value={region} onChange={e => setRegion(e.target.value)} placeholder="Where you are based" style={{ ...inputStyle, marginBottom: '20px' }} />
        <button onClick={handleSignUp} disabled={busy} style={{ width: '100%', padding: '12px', background: '#D4AF37', color: '#333333', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Creating account...' : 'Sign Up'}
        </button>
        <p style={{ textAlign: 'center', marginTop: '15px', color: '#333333' }}>
          Already have an account? <a href="/login" style={{ color: '#D4AF37', fontWeight: 'bold' }}>Login</a>
        </p>
      </div>
    </div>
  )
}
