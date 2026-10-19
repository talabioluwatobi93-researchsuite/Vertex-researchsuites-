import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireUser } from '@/lib/serverDb'
import { markJob } from '@/lib/jobGate'

export const runtime = 'nodejs'
export const maxDuration = 30

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/

export async function POST(req: NextRequest) {
  try {
    const db = adminDb()
    if (!db) return NextResponse.json({ error: 'Service is not configured.' }, { status: 500 })
    const user = await requireUser(req, db)
    if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const sessionId = body && body.sessionId
    const event = body && body.event
    if (typeof sessionId !== 'string' || !ID_RE.test(sessionId) || (event !== 'done' && event !== 'failed' && event !== 'abandon')) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { data: s } = await db.from('voice_transcription_sessions').select('id, user_id, audio_path, job_id, raw_transcript').eq('id', sessionId).maybeSingle()
    if (!s || s.user_id !== user.id) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    const hasText = typeof s.raw_transcript === 'string' && s.raw_transcript.trim().length > 0

    const removeAudio = async () => {
      if (!s.audio_path) return
      try { await db.storage.from('interview-audio').remove([s.audio_path]) } catch {}
    }

    if (event === 'done') {
      if (!hasText) return NextResponse.json({ error: 'Transcript is not saved yet.' }, { status: 409 })
      if (s.job_id) {
        await markJob(db, user.id, s.job_id, 'delivered')
        await markJob(db, user.id, s.job_id, 'done')
      }
      await removeAudio()
      return NextResponse.json({ ok: true })
    }
    if (event === 'failed') {
      if (s.job_id && !hasText) await markJob(db, user.id, s.job_id, 'failed', String((body && body.error) || '').slice(0, 200))
      return NextResponse.json({ ok: true })
    }
    if (!s.job_id && !hasText) await removeAudio()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('voice finish failed:', e)
    return NextResponse.json({ error: 'Could not finish. Please try again.' }, { status: 500 })
  }
}
