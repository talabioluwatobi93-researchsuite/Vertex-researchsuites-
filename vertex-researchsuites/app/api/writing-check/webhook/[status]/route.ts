import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ status: string }> }
) {
  try {
    const body = await req.json()
    const { status } = await params
    const scanId = body.scanId || body.developerPayload

    await supabase.from('writing_check_scans').upsert({
      scan_id: scanId || 'unknown',
      status: status,
      raw_payload: body,
      updated_at: new Date().toISOString(),
    })

    // If the scan is fully completed, request the detailed export
    if (status === 'completed' && body.results && scanId) {
      const loginResponse = await fetch('https://id.copyleaks.com/v3/account/login/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: process.env.COPYLEAKS_EMAIL,
          key: process.env.COPYLEAKS_API_KEY,
        }),
      })

      if (loginResponse.ok) {
        const loginData = await loginResponse.json()
        const accessToken = loginData.access_token

        const resultIds = Object.keys(body.results)
        const exportId = `export-${scanId}-${Date.now()}`

        const exportPayload = {
          completionWebhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/writing-check/export/completed`,
          results: resultIds.map((id) => ({
            id,
            endpoint: `${process.env.NEXT_PUBLIC_SITE_URL}/api/writing-check/export/result`,
            verb: 'POST',
          })),
          crawledVersion: {
            endpoint: `${process.env.NEXT_PUBLIC_SITE_URL}/api/writing-check/export/crawled`,
            verb: 'POST',
          },
        }

        await fetch(`https://api.copyleaks.com/v3/downloads/${scanId}/export/${exportId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(exportPayload),
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json({ received: false }, { status: 500 })
  }
}
