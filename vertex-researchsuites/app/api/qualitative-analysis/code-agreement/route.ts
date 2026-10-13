export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callQualCoderAChain, callQualCoderBChain } from '@/lib/openrouter'
import { requireSessionOwner } from '@/lib/qualAuth'
import { splitTranscript, batchBlocks, QualBlock } from '@/lib/qualBlocks'
import { cohenKappa, pairLabels } from '@/lib/cohenKappa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const BATCH_CHARS = 14000
const MIN_UNITS_FOR_KAPPA = 30 // below this, kappa is unstable
const MIN_COVERAGE = 0.9 // a coder must label at least 90% of a batch's paragraphs

type Settled = { ok: true; value: { content: string; providerUsed: string } } | { ok: false; reason: any }
function settle(p: Promise<{ content: string; providerUsed: string }>): Promise<Settled> {
  return p.then(
    (value): Settled => ({ ok: true, value }),
    (reason): Settled => ({ ok: false, reason })
  )
}

function parseLabels(raw: string, indexes: number[], themeNames: string[]): Record<string, string> | null {
  const m = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!m) return null
  let arr: any
  try {
    arr = JSON.parse(m[0])
  } catch {
    return null
  }
  if (!Array.isArray(arr)) return null
  const valid = new Set(indexes)
  const out: Record<string, string> = {}
  for (const it of arr) {
    const p = Number(it?.p)
    const t = Number(it?.t)
    if (!valid.has(p) || !Number.isInteger(t) || t < 0 || t > themeNames.length) continue
    out[String(p)] = t === 0 ? 'none' : themeNames[t - 1]
  }
  return Object.keys(out).length >= indexes.length * MIN_COVERAGE ? out : null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sessionId = body?.sessionId
    const action = body?.action ?? 'batch'
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }
    if (!['batch', 'finalize', 'decide'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const own = await requireSessionOwner(req, supabase, sessionId, 'raw_transcript, themes, agreement')
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status })
    const session = own.session
    if (!session.raw_transcript || !Array.isArray(session.themes) || session.themes.length === 0) {
      return NextResponse.json({ error: 'Transcript or themes not found. Please complete the earlier steps first.' }, { status: 404 })
    }

    const themes = session.themes as { name: string; description?: string }[]
    const themeNames = themes.map((t) => String(t.name))
    const all = splitTranscript(String(session.raw_transcript))
    const speakers = all.filter((b) => b.role === 'participant')
    const blocks = speakers.length ? speakers : all
    const batches = batchBlocks(blocks, BATCH_CHARS)
    const batchCount = Math.max(1, batches.length)
    const prev: any = session.agreement && typeof session.agreement === 'object' ? session.agreement : {}

    const save = async (agreement: any) => {
      const { error } = await supabase
        .from('qualitative_analysis_sessions')
        .update({ agreement })
        .eq('id', sessionId)
      if (error) throw new Error('Could not save the agreement data.')
    }

    if (action === 'decide') {
      const decision = body?.decision
      if (decision !== 'proceed' && decision !== 'stop') {
        return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
      }
      if (!prev.result) {
        return NextResponse.json({ error: 'Agreement has not been calculated yet.' }, { status: 409 })
      }
      await save({ ...prev, decision, decidedAt: new Date().toISOString() })
      return NextResponse.json({ ok: true, decision })
    }

    if (action === 'finalize') {
      const done: Record<string, { a: boolean; b: boolean }> = prev.batches || {}
      const units: number[] = []
      const failed: number[] = []
      batches.forEach((bt: QualBlock[], i: number) => {
        const st = done[String(i + 1)]
        if (st && st.a && st.b) bt.forEach((b) => units.push(b.index))
        else failed.push(i + 1)
      })
      const { a, b } = pairLabels(units, prev.labelsA || {}, prev.labelsB || {})
      const k = cohenKappa(a, b)
      const byIndex = new Map(blocks.map((bl) => [bl.index, bl]))
      const disagreementCount = a.filter((x, i) => x !== b[i]).length
      const disagreements = units
        .map((u, i) => ({ u, ca: a[i], cb: b[i] }))
        .filter((x) => x.ca !== x.cb)
        .slice(0, 300)
        .map((x) => {
          const bl = byIndex.get(x.u)
          return {
            blockIndex: x.u,
            participantId: bl ? bl.participantId : '',
            excerpt: bl ? bl.text.slice(0, 160) : '',
            coderA: x.ca,
            coderB: x.cb,
          }
        })
      const result = {
        ...k,
        message: units.length === 0
          ? 'Agreement could not be calculated because the second coder was not available for this transcript.'
          : k.message,
        unitsCompared: units.length,
        totalUnits: blocks.length,
        failedBatches: failed,
        percentAgreement: Math.round(k.observed * 1000) / 10,
        smallSample: units.length > 0 && units.length < MIN_UNITS_FOR_KAPPA,
        disagreementCount,
        disagreements,
        themeCount: themeNames.length,
        providerA: prev.providerA || null,
        providerB: prev.providerB || null,
        computedAt: new Date().toISOString(),
      }
      await save({ ...prev, result, decision: null })
      return NextResponse.json({ result })
    }

    // action === 'batch': Coder A and Coder B label every paragraph of one batch.
    const batchNo = Number(body?.batch ?? 1)
    if (!Number.isInteger(batchNo) || batchNo < 1 || batchNo > batchCount) {
      return NextResponse.json({ error: 'Invalid batch' }, { status: 400 })
    }
    const part: QualBlock[] = batches[batchNo - 1] || []
    const indexes = part.map((b) => b.index)

    const prompt = `You are coding part ${batchNo} of ${batchCount} of an interview transcript for thematic analysis.

CODEBOOK:
${themes.map((t, i) => `${i + 1}. ${t.name}${t.description ? ' - ' + t.description : ''}`).join('\n')}
0. none (the paragraph fits none of the themes)

PARAGRAPHS (each starts with its number in square brackets, then the speaker):
${part.map((b) => `[${b.index}] ${b.speaker ? b.speaker + ': ' : ''}${b.text}`).join('\n')}

Give every paragraph exactly ONE code: the number of the single theme that fits it best, or 0 if none fits.

Respond with ONLY a valid JSON array with one entry per paragraph, no other text, no markdown code fences, in exactly this format:
[ { "p": 12, "t": 2 } ]`

    const [ra, rb] = await Promise.all([
      settle(callQualCoderAChain(prompt, 25000)),
      settle(callQualCoderBChain(prompt, 25000)),
    ])
    for (const r of [ra, rb]) {
      if (!r.ok && String(r.reason?.message).startsWith('CONFIG_ERROR')) {
        return NextResponse.json({ error: 'The analysis service is not configured. Please contact support.' }, { status: 500 })
      }
    }
    const la = ra.ok ? parseLabels(ra.value.content, indexes, themeNames) : null
    const lb = rb.ok ? parseLabels(rb.value.content, indexes, themeNames) : null

    const base: any = batchNo === 1 ? {} : prev // batch 1 starts a fresh run
    await save({
      labelsA: { ...(base.labelsA || {}), ...(la || {}) },
      labelsB: { ...(base.labelsB || {}), ...(lb || {}) },
      batches: { ...(base.batches || {}), [String(batchNo)]: { a: !!la, b: !!lb } },
      providerA: ra.ok ? ra.value.providerUsed : base.providerA || null,
      providerB: rb.ok ? rb.value.providerUsed : base.providerB || null,
    })
    return NextResponse.json({ batch: batchNo, batchCount, aOk: !!la, bOk: !!lb })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Agreement check failed' }, { status: 500 })
  }
}
