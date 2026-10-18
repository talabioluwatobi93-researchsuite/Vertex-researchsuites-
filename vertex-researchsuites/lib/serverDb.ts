import { createClient } from "@supabase/supabase-js";

// Server-only helpers. Same logic as adminDb()/requireUser() on feature-referrals.
export function adminDb(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Proves who is calling: checks the login token with Supabase.
export async function requireUser(req: Request, db: any): Promise<{ id: string; meta: any } | null> {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return { id: data.user.id, meta: data.user.user_metadata || {} };
}
