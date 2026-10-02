'use client'

import { useState, useEffect } from 'react'
import { CITATION_STYLES } from '@/lib/citationStyles'
import { createClient } from '@supabase/supabase-js'

type Item = { id: string; text: string }
type Result = { id: string; text: string; ok: boolean; reason?: string }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= tasks.length) return
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export default function ReportRestylePage() {
  const [file, setFile] = useState<File | null>(null)
  const [style, setStyle] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [pricePerUse, setPricePerUse] = useState(0)
  const [userId, setUserId] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const formattedPrice = pricePerUse.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      try {
        const { data } = await supabase.from('feature_pricing').select('price').eq('feature_name', 'report_restyle').single()
        setPricePerUse(data?.price ?? 0)
      } catch {
        setPricePerUse(0)
      }
    }
    init()
  }, [])

  async function callRewrite(items: Item[]): Promise<Result[]> {
    try {
      const res = await fetch('/api/report-restyle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'rewrite', style, items }),
      })
      const data = await safeJson(res)
      if (!res.ok || !Array.isArray(data.results)) throw new Error(data.error || 'failed')
      return data.results as Result[]
    } catch {
      return items.map((it) => ({ id: it.id, text: it.text, ok: false, reason: 'request failed' }))
    }
  }

  async function refund(): Promise<boolean> {
    try {
      const { data: w } = await supabase.from('wallets').select('balance').eq('id', userId).single()
      const b = w?.balance ?? 0
      const { error: e } = await supabase.from('wallets').update({ balance: b + pricePerUse }).eq('id', userId)
      if (e) return false
      await supabase.from('transactions').insert({ user_id: userId, type: 'credit', amount: pricePerUse, status: 'success', description: 'Refund: Restyle Your Report' })
      return true
    } catch {
      return false
    }
  }

  function handleButtonClick() {
    if (!file) { setError('Please choose your .docx report first.'); return }
    if (!style) { setError('Please choose a citation style.'); return }
    setError('')
    if (pricePerUse === 0) {
      runRestyle()
    } else {
      setShowConfirm(true)
    }
  }

  async function handleAccept() {
    setShowConfirm(false)
    setError('')
    if (!userId) { setError('Please log in to continue.'); return }
    setBusy(true)
    try {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', userId).single()
      const balance = wallet?.balance ?? 0
      if (balance < pricePerUse) {
        setError('Your balance is not enough, kindly top up.')
        setBusy(false)
        return
      }
      const { error: deductError } = await supabase.from('wallets').update({ balance: balance - pricePerUse }).eq('id', userId)
      if (deductError) {
        setError('Could not process payment. Please try again.')
        setBusy(false)
        return
      }
      await supabase.from('transactions').insert({ user_id: userId, type: 'debit', amount: pricePerUse, status: 'success', description: 'Restyle Your Report' })
    } catch {
      setError('Something went wrong. Please try again.')
      setBusy(false)
      return
    }
    const ok = await runRestyle()
    if (!ok) {
      const refunded = await refund()
      setError((prev) => prev + (refunded ? ' You have not been charged: the amount was returned to your wallet.' : ' Please contact support to have your payment returned.'))
    }
  }

  async function runRestyle(): Promise<boolean> {
    if (!file || !style) return false
    setBusy(true)
    setError('')
    setSummary('')
    setWarnings([])
    try {
      // WALLET: the charge for this feature is added here in the next step.

      setStatus('Reading your report...')
      const fd = new FormData()
      fd.append('phase', 'parse')
      fd.append('style', style)
      fd.append('file', file)
      const pr = await fetch('/api/report-restyle', { method: 'POST', body: fd })
      const info = await safeJson(pr)
      if (!pr.ok) throw new Error(info.error || 'Could not read the report. The file may be too large (maximum 4 MB).')

      const items: Item[] = info.items || []
      const rewrites: Record<string, string> = {}
      const total = items.length
      let done = 0

      const batches: Item[][] = []
      for (let i = 0; i < items.length; i += 5) batches.push(items.slice(i, i + 5))
      setStatus('Applying the writing style (0 of ' + total + ' paragraphs)...')
      const first = await runPool(
        batches.map((b) => async () => {
          const res = await callRewrite(b)
          done += b.length
          setStatus('Applying the writing style (' + Math.min(done, total) + ' of ' + total + ' paragraphs)...')
          return res
        }),
        3
      )
      const okIds = new Set<string>()
      first.flat().forEach((r) => {
        if (r.ok) { rewrites[r.id] = r.text; okIds.add(r.id) }
      })

      const failed = items.filter((it) => !okIds.has(it.id))
      if (failed.length > 0) {
        setStatus('Retrying ' + failed.length + ' paragraph(s)...')
        const second = await runPool(failed.map((it) => async () => (await callRewrite([it]))[0]), 3)
        second.forEach((r) => {
          if (r && r.ok) { rewrites[r.id] = r.text; okIds.add(r.id) }
        })
      }
      const kept = total - okIds.size

      setStatus('Building your restyled report...')
      const fd2 = new FormData()
      fd2.append('phase', 'build')
      fd2.append('style', style)
      fd2.append('file', file)
      fd2.append('rewrites', JSON.stringify(rewrites))
      const br = await fetch('/api/report-restyle', { method: 'POST', body: fd2 })
      if (!br.ok) {
        const j = await safeJson(br)
        throw new Error(j.error || 'Could not build the document.')
      }
      const blob = await br.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.docx$/i, '') + '-' + style + '.docx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      const label = CITATION_STYLES.find((s) => s.value === style)?.label || style
      setStatus('')
      setSummary(
        'Done. ' + info.tableCount + ' tables restyled to ' + label + ', ' + info.imageCount + ' charts carried over, ' +
        okIds.size + ' of ' + total + ' paragraphs rewritten.' +
        (kept > 0
          ? ' ' + kept + ' paragraph(s) were kept in their original wording because the rewrite could not preserve every number exactly.'
          : '')
      )
      setWarnings(info.warnings || [])
      return true
    } catch (e: any) {
      setStatus('')
      setError(e?.message || 'Something went wrong. Please try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Restyle Your Report</h1>
      <p style={{ color: '#555', marginBottom: 24, lineHeight: 1.5 }}>
        Upload your Chapter 4 report (.docx) with SPSS-format tables and interpretations. Choose a citation style and
        every table, caption and interpretation is converted to that style. Your charts and numbers stay exactly as they are.
      </p>

      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>1. Your report (.docx, up to 4 MB)</label>
      <input
        type="file"
        accept=".docx"
        disabled={busy}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ marginBottom: 20, display: 'block' }}
      />

      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>2. Citation style</label>
      <select
        value={style}
        disabled={busy}
        onChange={(e) => setStyle(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 24, border: '1px solid #ccc', borderRadius: 6 }}
      >
        <option value="">Choose a style...</option>
        {CITATION_STYLES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <button
        onClick={handleButtonClick}
        disabled={busy}
        style={{
          width: '100%', padding: 14, border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600,
          background: busy ? '#999' : '#111', color: '#fff', cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? 'Working...' : pricePerUse > 0 ? 'Restyle and Download (₦' + formattedPrice + ')' : 'Restyle and Download'}
      </button>

      {status && <p style={{ marginTop: 16, color: '#333' }}>{status}</p>}
      {error && <p style={{ marginTop: 16, color: '#C00' }}>{error}</p>}
      {summary && <p style={{ marginTop: 16, color: '#1a6b2a', lineHeight: 1.5 }}>{summary}</p>}
      {warnings.map((w, i) => (
        <p key={i} style={{ marginTop: 8, color: '#8a6d00', fontSize: 14 }}>{w}</p>
      ))}
      {showConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 100 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center' }}>
            <p style={{ color: '#333333', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Confirm Payment</p>
            <p style={{ color: '#555555', fontSize: '14px', marginBottom: '20px' }}>
              ₦{formattedPrice} will be deducted from your wallet to restyle this report. Do you want to proceed?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, backgroundColor: '#EEEEEE', color: '#333333', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
              <button onClick={handleAccept} style={{ flex: 1, backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Accept</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
