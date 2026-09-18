import mammoth from 'mammoth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function bufferToText(buffer: Buffer, isPdf: boolean): Promise<string> {
  if (isPdf) {
    const pdfParseModule: any = await import('pdf-parse')
    const pdfParse = pdfParseModule.default || pdfParseModule
    const result = await pdfParse(buffer)
    return result.text || ''
  }
  const result = await mammoth.extractRawText({ buffer })
  return result.value || ''
}

// Reads a file previously uploaded to Supabase Storage.
export async function extractTextFromStoragePath(
  bucket: string,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) {
    throw new Error(`Could not download file from storage: ${error?.message || 'unknown error'}`)
  }
  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const isPdf = path.toLowerCase().endsWith('.pdf')
  return bufferToText(buffer, isPdf)
}

// Reads a file from a remote URL (e.g. a Google Doc export link, or a direct
// file link the student pasted).
export async function extractTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Could not fetch link: ${res.status} ${res.statusText}`)
  }
  const contentType = res.headers.get('content-type') || ''
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const isPdf = contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf')
  return bufferToText(buffer, isPdf)
}

// Convenience: given a session-like object with {_file_path, _link} fields,
// picks whichever is present and returns extracted text. Prefers file over link.
export async function extractTextFromFileOrLink(
  bucket: string,
  filePath: string | null,
  link: string | null
): Promise<string> {
  if (filePath) return extractTextFromStoragePath(bucket, filePath)
  if (link) return extractTextFromUrl(link)
  throw new Error('No file or link provided.')
}
