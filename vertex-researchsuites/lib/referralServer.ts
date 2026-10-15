import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// Server-only helpers for the referral routes.
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

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCode(len = 8): string {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

export function cleanCode(v: unknown): string {
  return String(v == null ? "" : v).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}
