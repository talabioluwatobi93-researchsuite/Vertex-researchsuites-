export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQualCoderAChain } from '@/lib/openrouter'
import { requireSessionOwner } from '@/lib/qualAuth'
import { splitTranscript, batchBlocks, findQuote, QualBlock } from '@/lib/qualBlocks'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const BATCH_CHARS = 14000 // participant text per call, so each call is fast
const PER_THEME = 2 // quotes per theme per batch, keeps the review list small

function parseArray(raw: string): any[] | null {
  const m = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!m) return null
  try {
    const arr = JSON.parse(m[0])
    return Array.isArray(arr) ? arr : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sessionId = body?.sessionId
    const batchNo = Number(body?.batch ?? 1)
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }
    if (!Number.isInteger(batchNo) || batchNo < 1) {
      return NextResponse.json({ error: 'Invalid batch' }, { status: 400 })
    }

    const own = await requireSessionOwner(req, supabase, sessionId, 'raw_transcript, themes')
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status })
    const session = own.session
    if (!session.raw_transcript || !session.themes) {
      return NextResponse.json({ error: 'Transcript or themes not found. Please complete Step 3 first.' }, { status: 404 })
    }

    const themeNames: string[] = (session.themes as any[]).map((t) => String(t.name))
    const all = splitTranscript(String(session.raw_transcript))
    const speakers = all.filter((b) => b.role === 'participant')
    const blocks = speakers.length ? speakers : all
    const batches = batchBlocks(blocks, BATCH_CHARS)
    const batchCount = Math.max(1, batches.length)
    if (batchNo > batchCount) {
      return NextResponse.json({ error: 'Invalid batch' }, { status: 400 })
    }
    const part: QualBlock[] = batches[batchNo - 1] || []

    const prompt = `You are a qualitative research expert doing thematic coding on part ${batchNo} of ${batchCount} of an interview transcript.

CONFIRMED THEMES:
${themeNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

PARAGRAPHS (each starts with its number in square brackets, then the speaker):
${part.map((b) => `[${b.index}] ${b.speaker ? b.speaker + ': ' : ''}${b.text}`).join('\n')}

For each theme, find up to ${PER_THEME} direct quotes in THESE paragraphs that illustrate it. Copy the words EXACTLY as they appear: do not paraphrase, correct, shorten with "..." or join separate sentences. A quote is one continuous stretch of a single paragraph, preferably one or two sentences. If a theme has no clear quote in these paragraphs, skip it.

Respond with ONLY a valid JSON array, no other text, no markdown code fences, in exactly this format:
[
  { "theme": "Theme name exactly as given above", "paragraph": 12, "quote": "exact words from that paragraph" }
]`

    let rawText: string
    try {
      const result = await callQualCoderAChain(prompt, 25000)
      rawText = result.content
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Quote assignment failed' }, { status: 500 })
    }

    const items = parseArray(rawText)
    if (!items) {
      return NextResponse.json({ error: 'Could not parse quote assignments. Please try again.' }, { status: 500 })
    }

    const byLower = new Map(themeNames.map((n) => [n.trim().toLowerCase(), n]))
    const perTheme: Record<string, number> = {}
    const seen = new Set<string>()
    const assignments: any[] = []
    let dropped = 0

    for (const it of items) {
      const theme = byLower.get(String(it?.theme ?? '').trim().toLowerCase())
      const claimed = part.find((b) => b.index === Number(it?.paragraph))
      const candidates = claimed ? [claimed, ...part.filter((b) => b !== claimed)] : part
      let blk: QualBlock | null = null
      let exact: string | null = null
      for (const b of candidates) {
        exact = findQuote(b.text, String(it?.quote ?? ''))
        if (exact) {
          blk = b
          break
        }
      }
      const key = blk ? blk.index + '|' + exact : ''
      if (!theme || !blk || !exact || seen.has(key) || (perTheme[theme] || 0) >= PER_THEME) {
        dropped++
        continue
      }
      seen.add(key)
      perTheme[theme] = (perTheme[theme] || 0) + 1
      assignments.push({
        theme,
        quote: exact,
        blockIndex: blk.index,
        participantId: blk.participantId,
        speaker: blk.speaker,
      })
    }

    return NextResponse.json({ assignments, batch: batchNo, batchCount, dropped })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Quote assignment failed' }, { status: 500 })
  }
}
