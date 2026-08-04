import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { text, userId } = await req.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No content provided.' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User not identified.' }, { status: 401 })
    }

    // Step 1: Log in to get an access token
    const loginResponse = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.COPYLEAKS_EMAIL,
        key: process.env.COPYLEAKS_API_KEY,
      }),
    })

    if (!loginResponse.ok) {
      return NextResponse.json({ error: 'Could not start the check. Please try again.' }, { status: 500 })
    }

    const loginData = await loginResponse.json()
    const accessToken = loginData.access_token

    // Step 2: Encode the text as base64
    const base64Content = Buffer.from(text, 'utf-8').toString('base64')

    // Step 3: Build a unique scan ID
    const scanId = `writing-check-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    // Step 4: Save a placeholder row so we can track this scan
    await supabase.from('writing_check_scans').insert({
      user_id: userId,
      scan_id: scanId,
      status: 'submitted',
    })

    // Step 5: Submit the text to Copyleaks for scanning
    const submitResponse = await fetch(
      `https://api.copyleaks.com/v3/scans/submit/file/${scanId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64: base64Content,
          filename: 'submission.txt',
          properties: {
            webhooks: {
              status: `${process.env.NEXT_PUBLIC_SITE_URL}/api/writing-check/webhook/{STATUS}`,
            },
            sandbox: true,
          },
        }),
      }
    )

    if (!submitResponse.ok) {
      return NextResponse.json({ error: 'Could not submit for checking. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ scanId, status: 'submitted' })
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
