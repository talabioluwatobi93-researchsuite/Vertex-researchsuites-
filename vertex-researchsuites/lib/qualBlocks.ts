// Phase 9 Q2: split a transcript into numbered blocks with speaker info,
// and find a quote inside a block so quotes are always verbatim.

export type QualBlock = {
  index: number // 1-based paragraph number, permanent
  speaker: string | null // label as written, e.g. "Speaker 2", "P3"
  participantId: string // normalized id, e.g. "P_03" or "Speaker_2"
  role: 'participant' | 'interviewer'
  timestamp: string | null // "mm:ss" if present
  text: string // the spoken text, without the speaker prefix
}

const MAX_BLOCK_CHARS = 1200
const INTERVIEWER_RE = /^(interviewer|moderator|researcher|facilitator|host|question(er)?|i)$/i

// "[12:03] Speaker 2: text" | "Speaker 2: text" | "P3: text" | "Interviewer: text"
const LINE_RE = /^\s*(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?([A-Za-z][A-Za-z0-9 _.-]{0,30}?)\s*:\s+(\S[\s\S]*)$/

function normalizeId(label: string): string {
  const m = label.trim().match(/^(?:participant|respondent|interviewee|p)[\s_.-]*(\d+)$/i)
  if (m) return 'P_' + m[1].padStart(2, '0')
  return label.trim().replace(/[\s.-]+/g, '_')
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_BLOCK_CHARS) return [text]
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text]
  const out: string[] = []
  let cur = ''
  for (const s of sentences) {
    if (cur && (cur + s).length > MAX_BLOCK_CHARS) {
      out.push(cur.trim())
      cur = ''
    }
    cur += s
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export function splitTranscript(raw: string): QualBlock[] {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n')
  const blocks: QualBlock[] = []
  let speaker: string | null = null
  let stamp: string | null = null
  let buf: string[] = []

  const flush = () => {
    const text = buf.join(' ').replace(/\s+/g, ' ').trim()
    buf = []
    if (!text) return
    const label = speaker
    for (const piece of splitLong(text)) {
      blocks.push({
        index: blocks.length + 1,
        speaker: label,
        participantId: label ? normalizeId(label) : 'P_01',
        role: label && INTERVIEWER_RE.test(label.trim()) ? 'interviewer' : 'participant',
        timestamp: stamp,
        text: piece,
      })
    }
  }

  for (const line of lines) {
    if (!line.trim()) {
      flush()
      continue
    }
    const m = line.match(LINE_RE)
    if (m) {
      flush()
      stamp = m[1] || null
      speaker = m[2].trim()
      buf.push(m[3])
    } else {
      buf.push(line.trim())
    }
  }
  flush()
  return blocks
}

// Group blocks into batches of at most maxChars (for model calls). Never splits a block.
export function batchBlocks(blocks: QualBlock[], maxChars: number): QualBlock[][] {
  const batches: QualBlock[][] = []
  let cur: QualBlock[] = []
  let size = 0
  for (const b of blocks) {
    if (cur.length && size + b.text.length > maxChars) {
      batches.push(cur)
      cur = []
      size = 0
    }
    cur.push(b)
    size += b.text.length
  }
  if (cur.length) batches.push(cur)
  return batches
}

function foldChar(c: string): string {
  if (/[\u2018\u2019\u201B]/.test(c)) return "'"
  if (/[\u201C\u201D\u201F]/.test(c)) return '"'
  if (/[\u2013\u2014]/.test(c)) return '-'
  return c.toLowerCase()
}

// Find `candidate` inside `blockText`, ignoring case, curly quotes, dashes and
// extra spaces. Returns the EXACT text from the block (never the model's text),
// or null if it is not really there.
export function findQuote(blockText: string, candidate: string): string | null {
  const cand = String(candidate || '').trim().replace(/^["'\u201C\u2018]+|["'\u201D\u2019]+$/g, '')
  if (cand.length < 8) return null
  const fold = (s: string) => {
    let out = ''
    const map: number[] = [] // folded index -> original index
    let lastSpace = false
    for (let i = 0; i < s.length; i++) {
      if (/\s/.test(s[i])) {
        if (!lastSpace && out) {
          out += ' '
          map.push(i)
        }
        lastSpace = true
      } else {
        out += foldChar(s[i])
        map.push(i)
        lastSpace = false
      }
    }
    return { out: out.replace(/ $/, ''), map }
  }
  const a = fold(blockText)
  const b = fold(cand).out
  if (b.length < 8) return null
  const at = a.out.indexOf(b)
  if (at < 0) return null
  const start = a.map[at]
  const end = a.map[at + b.length - 1] + 1
  return blockText.slice(start, end)
}
