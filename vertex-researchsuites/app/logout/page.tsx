'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LogoutPage() {
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working')

  useEffect(() => {
    supabase.auth.signOut().then(({ error }) => {
      setStatus(error ? 'error' : 'done')
    })
  }, [])

  const btn = { display: 'inline-block', padding: '12px 22px', borderRadius: '5px', fontWeight: 'bold' as const, textDecoration: 'none', marginRight: '10px' }

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', fontFamily: 'Arial', padding: '20px' }}>
      <div style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '80px', textAlign: 'center' }}>
        <h1 style={{ color: '#D4AF37', fontSize: '26px' }}>Vertex ResearchSuite</h1>
        {status === 'working' && <p style={{ color: '#333333' }}>Signing you out...</p>}
        {status === 'done' && (
          <div>
            <p style={{ color: '#333333', marginBottom: '30px' }}>You have been signed out.</p>
            <a href="/login" style={{ ...btn, background: '#D4AF37', color: '#333333' }}>Log in</a>
            <a href="/" style={{ ...btn, border: '2px solid #D4AF37', color: '#333333', marginRight: 0 }}>Home</a>
          </div>
        )}
        {status === 'error' && (
          <div>
            <p style={{ color: 'red', marginBottom: '30px' }}>Could not sign you out. Please try again.</p>
            <a href="/dashboard" style={{ ...btn, background: '#D4AF37', color: '#333333', marginRight: 0 }}>Back to dashboard</a>
          </div>
        )}
      </div>
    </div>
  )
}
