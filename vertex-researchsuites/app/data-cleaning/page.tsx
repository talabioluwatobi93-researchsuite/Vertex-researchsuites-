'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase';
import type { CodedQuestion } from '@/lib/dataCleaning'
import { buildCleanedFile, cleanedFileName, downloadBlob, loadSheet, SAVE_LIMIT_BYTES } from '@/lib/dataCleaningFile'
import type { LoadedSheet } from '@/lib/dataCleaningFile'
import { acceptCurrent, currentCol, redoColumn, skipCurrent, startFlow, codedInColumnOrder } from '@/lib/dataCleaningFlow'
import type { FlowState } from '@/lib/dataCleaningFlow'
import UploadStep from './UploadStep'
import CodeStep from './CodeStep'
import ReviewStep from './ReviewStep'
import DoneStep from './DoneStep'
import type { DoneInfo } from './DoneStep'
import { backLink, iconTile, muted, page, title, wrap } from './styles'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

type Step = 'upload' | 'code' | 'review' | 'done'

export default function DataCleaningPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [sheet, setSheet] = useState<LoadedSheet | null>(null)
  const [flow, setFlow] = useState<FlowState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DoneInfo | null>(null)
  const [jobId, setJobId] = useState('')
  const [gateOk, setGateOk] = useState(false)
  const [gateMsg, setGateMsg] = useState('')

  useEffect(() => {
    let active = true
    async function checkPurchase() {
      try {
        const j = new URLSearchParams(window.location.search).get('job') || ''
        const { data } = await supabase.auth.getSession()
        const token = data.session ? data.session.access_token : ''
        if (!token) {
          if (active) setGateMsg('Please log in to continue.')
          return
        }
        const h: Record<string, string> = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
        if (j) h['X-Job-Id'] = j
        const res = await fetch('/api/data-cleaning/job', { method: 'POST', headers: h, body: JSON.stringify({ action: 'check' }) })
        const body = await res.json().catch(() => null)
        if (!active) return
        if (res.ok && body && body.ok) {
          setJobId(j)
          setGateOk(true)
        } else {
          setGateMsg((body && body.error) || 'Please accept the package first.')
        }
      } catch {
        if (active) setGateMsg('Could not check your purchase. Please try again.')
      }
    }
    checkPurchase()
    return () => { active = false }
  }, [])

  async function markDone() {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session ? data.session.access_token : ''
      if (!token || !jobId) return
      await fetch('/api/data-cleaning/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Job-Id': jobId },
        body: JSON.stringify({ action: 'done' }),
      })
    } catch {}
  }

  async function handleFile(file: File) {
    setError('')
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError('Please upload an Excel file (.xlsx or .xls).')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('This file is too large (over 20 MB). Please remove unused sheets and try again.')
      return
    }
    try {
      const buf = await file.arrayBuffer()
      const loaded = loadSheet(buf)
      setBuffer(buf)
      setSheet(loaded)
      setFileName(file.name)
    } catch (err: any) {
      setError(err.message || 'Could not read this file.')
    }
  }

  function handleSheet(name: string) {
    if (!buffer) return
    try {
      setSheet(loadSheet(buffer, name))
      setError('')
    } catch (err: any) {
      setError(err.message || 'Could not read this sheet.')
    }
  }

  function handleStart(col: number) {
    if (!sheet) return
    setFlow(startFlow(sheet.grid, col))
    setStep('code')
  }

  function moveTo(next: FlowState) {
    setFlow(next)
    setStep(currentCol(next) === null ? 'review' : 'code')
  }

  function handleAccept(q: CodedQuestion) {
    if (flow) moveTo(acceptCurrent(flow, q))
  }

  function handleSkip() {
    if (flow) moveTo(skipCurrent(flow))
  }

  function handleRedo(col: number) {
    if (!flow) return
    setFlow(redoColumn(flow, col))
    setStep('code')
  }

  function handleRestart() {
    setStep('upload')
    setFileName('')
    setBuffer(null)
    setSheet(null)
    setFlow(null)
    setError('')
    setBusy(false)
    setResult(null)
  }

  async function saveToBunker(blob: Blob, name: string) {
    const finish = (status: 'saved' | 'failed', message: string) =>
      setResult((prev) => (prev ? { ...prev, saveStatus: status, saveMessage: message } : prev))
    if (blob.size > SAVE_LIMIT_BYTES) {
      finish('failed', 'The file is too large to save to your Bunker.')
      return
    }
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session ? data.session.access_token : ''
      if (!token) {
        finish('failed', 'Please log in again to save to your Bunker.')
        return
      }
      const form = new FormData()
      form.append('file', blob, name)
      form.append('itemName', 'Cleaned data - ' + name)
      const res = await fetch('/api/data-cleaning/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body || !body.success) {
        finish('failed', (body && body.error) || 'Could not save to your Bunker.')
        return
      }
      finish('saved', '')
    } catch (err: any) {
      finish('failed', err.message || 'Could not save to your Bunker.')
    }
  }

  // The download starts first, inside the tap, so the phone allows it. The Bunker save reports separately.
  function handleConfirm() {
    if (!flow || !buffer || !sheet) return
    setBusy(true)
    setError('')
    try {
      const built = buildCleanedFile(buffer, sheet.sheetName, codedInColumnOrder(flow))
      const name = cleanedFileName(fileName)
      downloadBlob(built.blob, name)
      setResult({
        name, blob: built.blob, replaced: built.replaced, unmapped: built.unmapped,
        codebookSheet: built.codebookSheet, saveStatus: 'saving', saveMessage: '',
      })
      setStep('done')
      markDone()
      saveToBunker(built.blob, name)
    } catch (err: any) {
      setError(err.message || 'Could not build the file.')
    }
    setBusy(false)
  }

  const col = flow ? currentCol(flow) : null

  if (!gateOk) {
    return (
      <div style={page}>
        <div style={wrap}>
          <p style={{ ...muted, margin: '40px 0 12px' }}>{gateMsg || 'Checking your purchase...'}</p>
          {gateMsg ? <button onClick={() => router.push('/data-cleaning/pricing')} style={backLink}>Go to the package page</button> : null}
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <div style={wrap}>
        <button onClick={() => router.push('/dashboard')} style={backLink}>← Back to Dashboard</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0 18px' }}>
          <div style={iconTile}>🔢</div>
          <div>
            <h1 style={title}>Quantitative Data Cleaning</h1>
            <p style={{ ...muted, margin: '4px 0 0' }}>Change word answers into numbers for analysis</p>
          </div>
        </div>
        {step === 'upload' && (
          <UploadStep fileName={fileName} sheet={sheet} error={error} onFile={handleFile} onSheet={handleSheet} onStart={handleStart} />
        )}
        {step === 'code' && sheet && flow && col !== null && (
          <CodeStep key={col} grid={sheet.grid} flow={flow} onAccept={handleAccept} onSkip={handleSkip} />
        )}
        {step === 'review' && sheet && flow && (
          <ReviewStep grid={sheet.grid} flow={flow} busy={busy} error={error} onRedo={handleRedo} onConfirm={handleConfirm} onRestart={handleRestart} />
        )}
        {step === 'done' && result && (
          <DoneStep
            info={result}
            onDownloadAgain={() => downloadBlob(result.blob, result.name)}
            onBunker={() => router.push('/bunker')}
            onAnother={() => router.push('/data-cleaning/pricing')}
          />
        )}
      </div>
    </div>
  )
}
