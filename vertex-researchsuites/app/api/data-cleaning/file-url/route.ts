import { NextResponse } from 'next/server'
import {
  adminClient, userIdFromRequest, isValidId, cleaningFolder, CLEANING_BUCKET, CLEANING_FILE_NAME,
} from '@/lib/dataCleaningServer'

// Gives the logged-in user a short-lived download link for one of their own cleaned files.
export async function POST(req: Request) {
  try {
    const admin = adminClient()
    const userId = await userIdFromRequest(req, admin)
    if (!userId) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 })

    const body = await req.json()
    if (!body || !isValidId(body.id)) {
      return NextResponse.json({ error: 'Missing or invalid file id.' }, { status: 400 })
    }
    const folder = cleaningFolder(userId, body.id)
    const { data: existing } = await admin.storage.from(CLEANING_BUCKET).list(folder)
    if (!existing || !existing.some((f) => f.name === CLEANING_FILE_NAME)) {
      return NextResponse.json({ error: 'File not found. It may have been removed.' }, { status: 404 })
    }
    const { data, error } = await admin.storage
      .from(CLEANING_BUCKET)
      .createSignedUrl(folder + '/' + CLEANING_FILE_NAME, 300)
    if (error || !data) {
      return NextResponse.json({ error: 'Could not create download link.' }, { status: 500 })
    }
    return NextResponse.json({ success: true, url: data.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to get the file.' }, { status: 500 })
  }
}
