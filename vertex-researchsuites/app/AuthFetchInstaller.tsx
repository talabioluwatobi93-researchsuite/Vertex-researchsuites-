'use client'

// Adds the signed-in user's token to calls to the analysis and voice API routes.
// Only when the call has no Authorization header yet.
const PREFIXES = ['/api/quantitative-analysis/', '/api/qualitative-analysis/', '/api/voice-transcription/']

function readToken(): string {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i) || ''
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const v = JSON.parse(window.localStorage.getItem(k) || 'null')
        const t = v && (v.access_token || (v.currentSession && v.currentSession.access_token))
        if (t) return String(t)
      }
    }
  } catch {}
  return ''
}

if (typeof window !== 'undefined' && !(window as any).__vxFetchPatched) {
  ;(window as any).__vxFetchPatched = true
  const orig = window.fetch.bind(window)
  ;(window as any).fetch = (input: any, init?: any) => {
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : ''
      if (raw) {
        const path = raw.startsWith('http') ? new URL(raw).pathname : raw
        if (PREFIXES.some((p) => path.startsWith(p))) {
          const headers = new Headers((init && init.headers) || undefined)
          if (!headers.has('authorization')) {
            const tok = readToken()
            if (tok) headers.set('Authorization', 'Bearer ' + tok)
          }
          return orig(input, { ...(init || {}), headers })
        }
      }
    } catch {}
    return orig(input, init)
  }
}

export default function AuthFetchInstaller() {
  return null
}
