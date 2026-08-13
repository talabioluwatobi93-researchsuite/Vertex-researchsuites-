import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ROUTE_TO_FLAG_KEY: Record<string, string> = {
  "/proposals": "proposals",
  "/writing-check": "writing-check",
  "/pilot-study": "pilot-study",
  "/quantitative-analysis": "quantitative-analysis",
  "/qualitative-analysis": "qualitative-analysis",
  "/bunker": "bunker",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const matchedPrefix = Object.keys(ROUTE_TO_FLAG_KEY).find(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (!matchedPrefix) {
    return NextResponse.next();
  }

  const flagKey = ROUTE_TO_FLAG_KEY[matchedPrefix];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data, error } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", flagKey)
    .maybeSingle();

  if (!error && data && data.enabled === false) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.set("maintenance", flagKey);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/proposals/:path*",
    "/writing-check/:path*",
    "/pilot-study/:path*",
    "/quantitative-analysis/:path*",
    "/qualitative-analysis/:path*",
    "/bunker/:path*",
  ],
};
