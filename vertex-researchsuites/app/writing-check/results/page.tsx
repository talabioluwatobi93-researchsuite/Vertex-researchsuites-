'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type ScanRow = {
  scan_id: string
  status: string
  raw_payload: any
  updated_at: string
}

export default function WritingCheckResultsPage() {
  const searchParams = useSearchParams()
  const scanIdsParam = searchParams.get('scans') || ''
  const scanIds = scanIdsParam.split(',').filter(Boolean)

  const [scans, setScans] = useState<ScanRow[]>([])
  const [polling, setPolling] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (scanIds.length === 0) {
      setErrorMsg('No scan found. Please submit your writing again.')
      setPolling(false)
      return
    }

    let attempts = 0
    const maxAttempts = 40 // ~ up to a few minutes of polling

    const interval = setInterval(async () => {
      attempts += 1

      const { data, error } = await supabase
        .from('writing_check_scans')
        .select('scan_id, status, raw_payload, updated_at')
        .in('scan_id', scanIds)

      if (error) {
        setErrorMsg('Something went wrong while checking your results.')
        clearInterval(interval)
        setPolling(false)
        return
      }

      if (data) setScans(data)

      const allDone = data && data.length === scanIds.length &&
        data.every((row) => row.status?.startsWith('export_') || row.status === 'completed')

      if (allDone || attempts >= maxAttempts) {
        clearInterval(interval)
        setPolling(false)
        if (!allDone && attempts >= maxAttempts) {
          setErrorMsg('This is taking longer than expected. Please check back shortly.')
        }
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
        Writing Check Results
      </h1>

      {polling && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', textAlign: 'center' }}>
          <p style={{ color: '#333333', fontSize: '14px' }}>Checking your writing... this may take a moment.</p>
        </div>
      )}

      {errorMsg && (
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '20px', marginTop: '12px' }}>
          <p style={{ color: '#C0392B', fontSize: '14px' }}>{errorMsg}</p>
        </div>
      )}

      {!polling && scans.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          {scans.map((scan) => (
            <div key={scan.scan_id} style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#333333', marginBottom: '8px' }}>
                Scan: {scan.scan_id} &middot; Status: {scan.status}
              </p>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px', color: '#555555', backgroundColor: '#F9F9F9', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
                {JSON.stringify(scan.raw_payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
