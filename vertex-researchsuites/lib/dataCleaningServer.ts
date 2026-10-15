// Server-only helpers for the data cleaning feature (Bunker save and download).
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const CLEANING_BUCKET = 'quant-bunker'
export const CLEANING_ITEM_TYPE = 'quantitative_data_cleaning'
export const CLEANING_FILE_NAME = 'cleaned-data.xlsx'
export const CLEANING_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
// Hosting limits a request body to about 4.5 MB, so stay safely under it.
// Keep equal to SAVE_LIMIT_BYTES in lib/dataCleaningFile.ts.
export const MAX_SAVE_BYTES = 4 * 1024 * 1024
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
}

// The logged-in user's id from the "Authorization: Bearer <token>" header, or null.
export async function userIdFromRequest(req: Request, admin: SupabaseClient): Promise<string | null> {
  const header = req.headers.get('authorization') || ''
  const token = /^bearer /i.test(header) ? header.slice(7).trim() : ''
  if (token === '') return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data || !data.user) return null
  return data.user.id
}

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id)
}

// The folder always contains the verified user id, so nobody can open another user's file.
export function cleaningFolder(userId: string, id: string): string {
  return 'cleaning/' + userId + '/' + id
}
