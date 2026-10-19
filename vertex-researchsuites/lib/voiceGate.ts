import { markJob } from '@/lib/jobGate'

export type VGate =
  | { ok: true; jobId: string | null }
  | { ok: false; error: string; status: number }

const RATE_KEY: Record<string, string> = {
  voice_african: 'voice_african_per_min',
  voice_global: 'voice_global_per_min',
}

export async function checkVoiceJob(db: any, userId: string, sessionId: string, engine: string): Promise<VGate> {
  const rateKey = RATE_KEY[engine]
  if (!rateKey) return { ok: false, error: 'Invalid request.', status: 400 }
  const { data: p, error: pe } = await db.from('feature_pricing').select('price').eq('feature_name', rateKey).maybeSingle()
  if (pe) return { ok: false, error: 'Could not check pricing. Please try again.', status: 500 }
  if (!(Number(p && p.price) > 0)) return { ok: true, jobId: null }
  const { data: s, error: se } = await db.from('voice_transcription_sessions').select('user_id, job_id').eq('id', sessionId).maybeSingle()
  if (se) return { ok: false, error: 'Could not check your purchase. Please try again.', status: 500 }
  if (!s || s.user_id !== userId) return { ok: false, error: 'Session not found.', status: 404 }
  if (!s.job_id) return { ok: false, error: 'Please confirm the charge first.', status: 402 }
  const { data: j, error: je } = await db.from('feature_jobs').select('id, user_id, feature, status, deadline_at').eq('id', s.job_id).maybeSingle()
  if (je) return { ok: false, error: 'Could not check your purchase. Please try again.', status: 500 }
  if (!j || j.user_id !== userId || j.feature !== engine) return { ok: false, error: 'This purchase was not found.', status: 403 }
  if (j.status !== 'open') return { ok: false, error: 'This purchase is already used. Please start again.', status: 402 }
  if (new Date(j.deadline_at).getTime() <= Date.now()) return { ok: false, error: 'This purchase has expired. Please start again.', status: 402 }
  return { ok: true, jobId: j.id }
}

export async function checkVoiceJobByPath(db: any, userId: string, audioPath: string, engine: string): Promise<VGate> {
  const { data: s } = await db.from('voice_transcription_sessions').select('id').eq('user_id', userId).eq('audio_path', audioPath).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!s) return { ok: false, error: 'Session not found.', status: 404 }
  return checkVoiceJob(db, userId, s.id, engine)
}

export { markJob }
