'use client'

import { createClient } from '@supabase/supabase-js'

// Adds the signed-in user's token to calls to the analysis and voice API routes.
// Only when the call has no Authorization header yet.
// The token is asked from the login library, which renews it if it expired.
const PREFIXES = ['/api/quantitative-analysis/', '/api/qualitative-analysis/', '/api/voice-transcription/']

let client: any = null
function getClient(): any {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: true } }
    )
  }
  return client
}

async function freshToken(): Promise<string> {
  try {
    const { data } = await getClient().auth.getSession()
    return data?.session?.access_token || ''
  } catch {}
  return ''
}

if (typeof window !== 'undefined' && !(window as any).__vxFetchPatched) {
  ;(window as any).__vxFetchPatched = true
  const orig = window.fetch.bind(window)
  ;(window as any).fetch = async (input: any, init?: any) => {
    let opts = init
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : ''
      if (raw) {
        const path = raw.startsWith('http') ? new URL(raw).pathname : raw
        if (PREFIXES.some((p) => path.startsWith(p))) {
          const headers = new Headers((init && init.headers) || undefined)
          if (!headers.has('authorization')) {
            const tok = await freshToken()
            if (tok) headers.set('Authorization', 'Bearer ' + tok)
          }
          opts = { ...(init || {}), headers }
        }
      }
    } catch {}
    return orig(input, opts)
  }
}

export default function AuthFetchInstaller() {
  return null
}
