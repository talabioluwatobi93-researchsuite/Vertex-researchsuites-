import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Disabled: this route trusted a user id from the request and fetched any link.
// The page no longer uses it.
export async function POST() {
  return NextResponse.json({ error: 'This option is not available.' }, { status: 410 })
}
