import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireUser } from '@/lib/serverDb'
import { markJob } from '@/lib/jobGate'
import { checkOpenJob } from '@/lib/jobOpen'

// Checks the logged-in user has an open Qualitative Analysis purchase,
// and closes it once the analysis session has been saved.
export async function POST(req: NextRequest) {
  try {
    const db = adminDb()
    if (!db) return NextResponse.json({ error: 'Service is not configured.' }, { status: 500 })
    const user = await requireUser(req, db)
    if (!user) return NextResponse.json({ error: 'Please log in to continue.' }, { status: 401 })
    const gate = await checkOpenJob(db, user.id, 'qualitative_analysis')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
    let action = 'check'
    try {
      const b = await req.json()
      if (b && b.action) action = String(b.action)
    } catch {}
    if (action === 'done') {
      await markJob(db, user.id, gate.jobId, 'delivered')
      await markJob(db, user.id, gate.jobId, 'done')
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('qualitative job route failed:', e)
    return NextResponse.json({ error: 'Could not check your purchase. Please try again.' }, { status: 500 })
  }
}
