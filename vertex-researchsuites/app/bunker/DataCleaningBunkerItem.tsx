'use client'

import { useState } from 'react'

type Props = {
  fileId: string
  getToken: () => Promise<string>
}

// Shown inside the Bunker detail card for a saved cleaned data file.
export default function DataCleaningBunkerItem({ fileId, getToken }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setBusy(true)
    setError('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Please log in again.')
      const res = await fetch('/api/data-cleaning/file-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ id: fileId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || !data.url) {
        throw new Error((data && data.error) || 'Could not prepare the download.')
      }
      const a = document.createElement('a')
      a.href = data.url
      a.download = 'cleaned-data.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: any) {
      setError(err.message || 'Could not prepare the download.')
    }
    setBusy(false)
  }

  return (
    <span style={{ display: 'block' }}>
      <span style={{ display: 'block', color: '#333333', fontSize: '15px', fontWeight: 700 }}>
        Your cleaned data file is saved
      </span>
      <span style={{ display: 'block', color: '#888888', fontSize: '13px', margin: '4px 0 14px' }}>
        An Excel file with your words changed to numbers. A Codebook sheet lists every word and its number.
      </span>
      <button
        onClick={handleDownload}
        disabled={busy}
        style={{
          backgroundColor: busy ? '#EEEEEE' : '#D4AF37',
          color: '#333333',
          border: 'none',
          borderRadius: '10px',
          padding: '12px 18px',
          fontSize: '14px',
          fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? 'Preparing...' : 'Download cleaned file'}
      </button>
      {error && (
        <span style={{ display: 'block', backgroundColor: '#FDEDEC', color: '#C0392B', fontSize: '13px', borderRadius: '10px', padding: '10px 12px', marginTop: '12px' }}>
          {error}
        </span>
      )}
    </span>
  )
}
