'use client'

import { supabase } from '@/lib/supabase'

// Adds the signed-in user's token to calls to the analysis and voice API routes.
// Uses the one shared login client, so there is a single login to keep fresh.
// If the server answers 401, the login is renewed once and the call is repeated once.
const PREFIXES = ['/api/quantitative-analysis/', '/api/qualitative-analysis/', '/api/voice-transcription/']

async function currentToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || ''
  } catch {}
  return ''
}

let renewing: Promise<string> | null = null
async function doRenew(): Promise<string> {
  try {
    const { data } = await supabase.auth.refreshSession()
    return data?.session?.access_token || ''
  } catch {} finally {
    renewing = null
  }
  return ''
}
function renewToken(): Promise<string> {
  if (!renewing) renewing = doRenew()
  return renewing
}

if (typeof window !== 'undefined' && !(window as any).__vxFetchPatched) {
  ;(window as any).__vxFetchPatched = true
  const orig = window.fetch.bind(window)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') currentToken()
  })
  ;(window as any).fetch = async (input: any, init?: any) => {
    let isTarget = false
    let opts = init
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : ''
      if (raw) {
        const path = raw.startsWith('http') ? new URL(raw).pathname : raw
        if (PREFIXES.some((p) => path.startsWith(p))) {
          isTarget = true
          const headers = new Headers((init && init.headers) || undefined)
          if (!headers.has('authorization')) {
            const tok = await currentToken()
            if (tok) headers.set('Authorization', 'Bearer ' + tok)
          }
          opts = { ...(init || {}), headers }
        }
      }
    } catch {}
    const res = await orig(input, opts)
    if (!isTarget || res.status !== 401) return res
    const b = opts && opts.body
    if (typeof ReadableStream !== 'undefined' && b instanceof ReadableStream) return res
    try {
      const tok = await renewToken()
      if (!tok) return res
      const h = new Headers((opts && opts.headers) || undefined)
      h.set('Authorization', 'Bearer ' + tok)
      return await orig(input, { ...(opts || {}), headers: h })
    } catch {}
    return res
  }
}

export default function AuthFetchInstaller() {
  return null
}
