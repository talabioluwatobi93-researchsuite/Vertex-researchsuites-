// Server-side helpers for the Intron routes: service client and "who is calling" check.
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

// The page sends the signed-in user's Supabase access token as "Authorization: Bearer <token>".
export async function requireUser(req: NextRequest): Promise<{ id: string } | null> {
  const header = req.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const { data, error } = await getAdmin().auth.getUser(m[1]);
  if (error || !data || !data.user) return null;
  return { id: data.user.id };
}
