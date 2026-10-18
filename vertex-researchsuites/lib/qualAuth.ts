// Phase 9 Q4a: owner check for qualitative routes + token header for pages.
// Server: the route calls requireSessionOwner(). Client: pages call qualAuthHeaders().

export type OwnerCheck =
  | { ok: true; userId: string; session: any }
  | { ok: false; status: number; error: string }

// `supabase` is the server client (secret key). `columns` is what the route needs,
// e.g. 'raw_transcript, themes'. user_id is always added.
export async function requireSessionOwner(
  req: Request,
  supabase: any,
  sessionId: string,
  columns: string
): Promise<OwnerCheck> {
  const header = req.headers.get('authorization') || ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return { ok: false, status: 401, error: 'Please sign in again.' }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  const userId = userData?.user?.id
  if (userErr || !userId) return { ok: false, status: 401, error: 'Please sign in again.' }

  const { data: session, error } = await supabase
    .from('qualitative_analysis_sessions')
    .select('user_id, ' + columns)
    .eq('id', sessionId)
    .single()

  // Same answer for "missing" and "not yours" so ids cannot be probed.
  if (error || !session || session.user_id !== userId) {
    return { ok: false, status: 404, error: 'Session not found.' }
  }
  return { ok: true, userId, session }
}

// Page side: headers with the signed-in user's access token.
export async function qualAuthHeaders(supabaseClient: any): Promise<Record<string, string>> {
  const { data } = await supabaseClient.auth.getSession()
  const token = data?.session?.access_token
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = 'Bearer ' + token
  return h
}
