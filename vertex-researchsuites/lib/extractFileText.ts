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

// Parses a public Google Forms link by extracting the embedded FB_PUBLIC_LOAD_DATA_
// JSON blob, which contains every question and its answer options in the exact
// order they appear on the form. This avoids trying to run a raw HTML page
// through a PDF/DOCX parser (which always fails).
async function extractTextFromGoogleForm(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Could not fetch Google Form: ${res.status} ${res.statusText}`)
  }
  const html = await res.text()

  const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);/) || html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*\])\s*<\/script>/)
  if (!match) {
    throw new Error("Could not locate form data in the page. This link may not be a public Google Form.")
  }

  let formData: any
  try {
    formData = JSON.parse(match[1])
  } catch (e) {
    throw new Error("Google Form data could not be parsed as JSON.")
  }

  const fields = formData?.[1]?.[1]
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("No questions found in this Google Form.")
  }

  const lines: string[] = []
  let qNum = 0

  for (const field of fields) {
    try {
      const fieldType = field?.[3]
      if (fieldType === 8) continue // section header / page break -- not a question

      const title = field?.[1]
      const optionGroups = field?.[4]
      if (!title || typeof title !== "string" || !title.trim()) continue

      qNum += 1
      lines.push(`${qNum}. ${title}`)

      if (Array.isArray(optionGroups) && optionGroups[0] && Array.isArray(optionGroups[0][1])) {
        const options = optionGroups[0][1]
        options.forEach((opt: any, i: number) => {
          const label = Array.isArray(opt) ? opt[0] : opt
          if (label && typeof label === "string") {
            lines.push(`   ${i + 1} = ${label}`)
          }
        })
      }
      lines.push("")
    } catch {
      continue
    }
  }

  const result = lines.join("\n").trim()
  if (!result) {
    throw new Error("Google Form was reachable but no readable questions could be extracted.")
  }
  return result
}

// Reads a file from a remote URL (e.g. a Google Doc export link, or a direct
// file link the student pasted).
export async function extractTextFromUrl(url: string): Promise<string> {
  if (url.includes("docs.google.com/forms")) {
    return extractTextFromGoogleForm(url)
  }
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
