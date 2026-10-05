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

  const match =
    html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/) ||
    html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*\])\s*<\/script>/)
  if (!match) {
    throw new Error("Could not locate form data in the page. This link may not be a public Google Form.")
  }

  let formData: any
  try {
    formData = JSON.parse(match[1])
  } catch {
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
      const title = field?.[1]
      const description =
        typeof field?.[2] === "string" && field[2].trim() ? field[2].trim().slice(0, 400) : ""
      if (!title || typeof title !== "string" || !title.trim()) continue

      if (fieldType === 8) {
        lines.push(`Section: ${title.trim()}`)
        if (description) lines.push(`   ${description}`)
        lines.push("")
        continue
      }

      const groups: any[] = Array.isArray(field?.[4]) ? field[4] : []

      if (fieldType === 7 && groups.length > 0) {
        for (const g of groups) {
          const rowLabel =
            Array.isArray(g?.[3]) && typeof g[3][0] === "string" ? g[3][0].trim() : ""
          qNum += 1
          lines.push(`${qNum}. ${title.trim()}${rowLabel ? ` [${rowLabel}]` : ""}`)
          if (description) lines.push(`   Note: ${description}`)
          lines.push(...googleFormOptionLines(g, fieldType))
          lines.push("")
        }
        continue
      }

      qNum += 1
      lines.push(`${qNum}. ${title.trim()}`)
      if (description) lines.push(`   Note: ${description}`)
      if (groups[0]) lines.push(...googleFormOptionLines(groups[0], fieldType))
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

function googleFormOptionLabels(options: any): string[] {
  if (!Array.isArray(options)) return []
  return options
    .map((o: any) => (Array.isArray(o) ? o[0] : o))
    .filter((l: any) => typeof l === "string" && l.trim() !== "")
    .map((l: string) => l.trim())
}

function googleFormOptionLines(group: any, fieldType: number): string[] {
  const labels = googleFormOptionLabels(group?.[1])
  if (labels.length === 0) return []

  const ends: any[] = Array.isArray(group?.[3]) ? group[3] : []
  const low = typeof ends[0] === "string" ? ends[0].trim() : ""
  const high = typeof ends[1] === "string" ? ends[1].trim() : ""
  const numericOnly = labels.every((l: string) => /^-?\d+$/.test(l))
  const isScale = fieldType === 5 || (numericOnly && (low !== "" || high !== ""))

  const out: string[] = []
  if (isScale) {
    const first = labels[0]
    const last = labels[labels.length - 1]
    out.push(`   Rating scale from ${first} to ${last} (${labels.length} points)`)
    if (low) out.push(`   ${first} = ${low}`)
    if (high) out.push(`   ${last} = ${high}`)
    if (labels.length > 2) {
      out.push("   (only the end points are labelled in the form; the points between are not named)")
    }
    return out
  }

  labels.forEach((label: string, i: number) => {
    out.push(`   ${i + 1} = ${label}`)
  })
  return out
}

// Reads a file from a remote URL (e.g. a Google Doc export link, or a direct
// file link the student pasted).
export async function extractTextFromUrl(url: string): Promise<string> {
  const clean = url.trim()
  if (clean.includes("docs.google.com/forms")) {
    return extractTextFromGoogleForm(clean)
  }

  const fetchUrl = toDirectDownloadUrl(clean)
  const res = await fetch(fetchUrl, { redirect: "follow" })
  if (res.url && res.url.includes("accounts.google.com")) {
    throw new Error(PRIVATE_LINK_MESSAGE)
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new Error(PRIVATE_LINK_MESSAGE)
    }
    throw new Error(`Could not fetch link: ${res.status} ${res.statusText}`)
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase()
  const buffer = Buffer.from(await res.arrayBuffer())
  const path = fetchUrl.toLowerCase().split("?")[0]

  const isPdf =
    contentType.includes("pdf") || path.endsWith(".pdf") || buffer.slice(0, 5).toString("latin1") === "%PDF-"
  if (isPdf) return bufferToText(buffer, true)

  const isDocx =
    contentType.includes("wordprocessingml") || path.endsWith(".docx") || (buffer[0] === 0x50 && buffer[1] === 0x4b)
  if (isDocx) return bufferToText(buffer, false)

  const body = buffer.toString("utf-8")
  if (contentType.includes("html") || /^\s*<(!doctype|html)/i.test(body)) {
    const text = htmlToText(body)
    if (!text) throw new Error(PRIVATE_LINK_MESSAGE)
    return text
  }
  return body.trim()
}

const PRIVATE_LINK_MESSAGE =
  "This link could not be read. If it is a Google Doc, Google Form or Drive file, set sharing to 'Anyone with the link can view' and try again."

function toDirectDownloadUrl(url: string): string {
  const doc = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (doc && doc[1] !== "e") {
    return `https://docs.google.com/document/d/${doc[1]}/export?format=txt`
  }
  const file =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/)
  if (file) {
    return `https://drive.google.com/uc?export=download&id=${file[1]}`
  }
  return url
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
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
