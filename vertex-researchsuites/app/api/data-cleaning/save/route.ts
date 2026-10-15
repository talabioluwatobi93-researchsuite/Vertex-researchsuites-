import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  adminClient, userIdFromRequest, cleaningFolder,
  CLEANING_BUCKET, CLEANING_FILE_NAME, CLEANING_ITEM_TYPE, CLEANING_MIME, MAX_SAVE_BYTES,
} from '@/lib/dataCleaningServer'

// Saves the cleaned Excel file for the logged-in user and adds it to their Bunker.
export async function POST(req: Request) {
  try {
    const admin = adminClient()
    const userId = await userIdFromRequest(req, admin)
    if (!userId) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: 'No file received.' }, { status: 400 })
    }
    if (file.size > MAX_SAVE_BYTES) {
      return NextResponse.json(
        { error: 'This file is too large to save to your Bunker. Your download is not affected.' },
        { status: 413 }
      )
    }
    const itemName = String(form.get('itemName') || '').trim().slice(0, 120) || 'Cleaned data'

    const id = randomUUID()
    const path = cleaningFolder(userId, id) + '/' + CLEANING_FILE_NAME
    const bytes = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from(CLEANING_BUCKET)
      .upload(path, bytes, { upsert: true, contentType: CLEANING_MIME })
    if (uploadError) {
      return NextResponse.json({ error: 'Could not store the file: ' + uploadError.message }, { status: 500 })
    }

    const { error: insertError } = await admin.from('bunker_items').insert({
      user_id: userId,
      item_name: itemName,
      item_type: CLEANING_ITEM_TYPE,
      content_reference: id,
      is_read: false,
    })
    if (insertError) {
      await admin.storage.from(CLEANING_BUCKET).remove([path])
      return NextResponse.json({ error: 'Could not save to your Bunker: ' + insertError.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save the file.' }, { status: 500 })
  }
}
