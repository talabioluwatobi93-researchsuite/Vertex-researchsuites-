import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: { status: string } }
) {
  try {
    const body = await req.json()
    const status = params.status

    // Copyleaks sends different payloads depending on the status type
    // We store the raw result for now, linked to the scanId
    await supabase.from('writing_check_scans').upsert({
      scan_id: body.scanId || body.developerPayload || 'unknown',
      status: status,
      raw_payload: body,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json({ received: false }, { status: 500 })
  }
}
