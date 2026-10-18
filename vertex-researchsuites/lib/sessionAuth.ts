import { adminDb, requireUser } from '@/lib/serverDb'

export type Access =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }

const TABLES = ['quantitative_analysis_sessions', 'qualitative_analysis_sessions']

// Login only (no session id involved).
export async function requireLogin(req: Request): Promise<Access> {
  const db = adminDb()
  if (!db) return { ok: false, status: 500, error: 'Service is not configured.' }
  const user = await requireUser(req, db)
  if (!user) return { ok: false, status: 401, error: 'Please sign in again.' }
  return { ok: true, userId: user.id }
}

// Login + the session must belong to the caller. Same answer for missing and not yours.
export async function requireSessionAccess(req: Request, sessionId: any, table: string): Promise<Access> {
  if (!sessionId || typeof sessionId !== 'string') return { ok: false, status: 400, error: 'Missing sessionId' }
  if (!TABLES.includes(table)) return { ok: false, status: 500, error: 'Bad table.' }
  const db = adminDb()
  if (!db) return { ok: false, status: 500, error: 'Service is not configured.' }
  const user = await requireUser(req, db)
  if (!user) return { ok: false, status: 401, error: 'Please sign in again.' }
  const { data, error } = await db.from(table).select('user_id').eq('id', sessionId).maybeSingle()
  if (error || !data || data.user_id !== user.id) return { ok: false, status: 404, error: 'Session not found.' }
  return { ok: true, userId: user.id }
}
