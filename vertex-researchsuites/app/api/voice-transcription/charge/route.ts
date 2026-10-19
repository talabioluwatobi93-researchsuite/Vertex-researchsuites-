import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { adminDb, requireUser } from '@/lib/serverDb'
import { probeAudioSeconds } from '@/lib/voiceProbe'

export const runtime = 'nodejs'
export const maxDuration = 60

const RATE_KEY: Record<string, string> = { voice_african: 'voice_african_per_min', voice_global: 'voice_global_per_min' }
const LABEL: Record<string, string> = { voice_african: 'African languages', voice_global: 'Global languages' }
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/

export async function POST(req: NextRequest) {
  try {
    const db = adminDb()
    if (!db) return NextResponse.json({ error: 'Service is not configured.' }, { status: 500 })
    const user = await requireUser(req, db)
    if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const sessionId = body && body.sessionId
    const engine = body && body.engine
    const action = body && body.action
    if (typeof sessionId !== 'string' || !ID_RE.test(sessionId) || typeof engine !== 'string' || !RATE_KEY[engine] || (action !== 'quote' && action !== 'charge')) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { data: session } = await db.from('voice_transcription_sessions').select('id, user_id, audio_path').eq('id', sessionId).maybeSingle()
    if (!session || session.user_id !== user.id || !session.audio_path) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    const { data: p, error: pe } = await db.from('feature_pricing').select('price').eq('feature_name', RATE_KEY[engine]).maybeSingle()
    if (pe) return NextResponse.json({ error: 'Could not check pricing. Please try again.' }, { status: 500 })
    const rate = Number(p && p.price) || 0
    if (!(rate > 0)) return NextResponse.json({ ok: true, free: true })

    let seconds = 0
    try {
      seconds = await probeAudioSeconds(db, session.audio_path)
    } catch {
      return NextResponse.json({ error: 'We could not read the length of this audio file. Please try another file.' }, { status: 500 })
    }
    if (!(seconds > 0)) return NextResponse.json({ error: 'We could not read the length of this audio file. Please try another file.' }, { status: 400 })

    const minutes = Math.max(1, Math.ceil(seconds / 60))
    const amount = rate * minutes
    const fp = typeof body.fingerprint === 'string' && body.fingerprint ? body.fingerprint.slice(0, 300) : sessionId
    const ref = createHash('sha256').update(user.id + '|' + fp).digest('hex').slice(0, 20) + ':' + minutes

    if (action === 'quote') {
      const { data: open } = await db.from('feature_jobs').select('id').eq('user_id', user.id).eq('feature', engine).eq('job_ref', ref).eq('status', 'open').gt('deadline_at', new Date().toISOString()).limit(1).maybeSingle()
      return NextResponse.json({ ok: true, minutes, rate, amount, retry: !!open })
    }

    const { data: r, error: re } = await db.rpc('voice_start_job', {
      p_user: user.id,
      p_engine: engine,
      p_minutes: minutes,
      p_ref: ref,
      p_description: 'Voice Transcription (' + LABEL[engine] + ') ' + minutes + ' min',
    })
    if (re || !r) return NextResponse.json({ error: 'Could not process payment. Please try again.' }, { status: 500 })
    if (r.error === 'insufficient') return NextResponse.json({ error: 'Your balance is not enough. Kindly top up.' }, { status: 402 })
    if (r.error) return NextResponse.json({ error: 'Could not process payment. Please try again.' }, { status: 400 })

    if (r.job_id) {
      const { error: ue } = await db.from('voice_transcription_sessions').update({ job_id: r.job_id }).eq('id', sessionId).eq('user_id', user.id)
      if (ue) return NextResponse.json({ error: 'Your payment was recorded but could not be linked. Please try again. You will not be charged twice.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, minutes, amount, resumed: !!r.resumed })
  } catch (e: any) {
    console.error('voice charge failed:', e)
    return NextResponse.json({ error: 'Could not process payment. Please try again.' }, { status: 500 })
  }
}
