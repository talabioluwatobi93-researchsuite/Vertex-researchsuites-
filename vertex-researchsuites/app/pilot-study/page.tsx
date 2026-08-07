'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function PilotStudyUploadPage() {
  const router = useRouter()
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['.xlsx', '.xls', '.csv']
    const isValid = validTypes.some((ext) => file.name.toLowerCase().endsWith(ext))
    if (!isValid) {
      setErrorMsg('Please upload a .xlsx, .xls, or .csv file.')
      return
    }

    setFileName(file.name)
    setErrorMsg('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErrorMsg('You need to be logged in to continue.')
        setLoading(false)
        return
      }

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[firstSheetName]
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

      if (!rows || rows.length < 2) {
        setErrorMsg('This file looks empty or has no data rows. Please check your file and try again.')
        setLoading(false)
        return
      }

      const columnHeaders = rows[0]
      const dataRows = rows.slice(1)

      const { data: session, error } = await supabase
        .from('pilot_study_sessions')
        .insert({
          user_id: user.id,
          status: 'uploaded',
          file_name: file.name,
          column_headers: columnHeaders,
          raw_data: dataRows,
        })
        .select('id')
        .single()

      if (error || !session) {
        setErrorMsg('Something went wrong saving your file. Please try again.')
        setLoading(false)
        return
      }

      router.push(`/pilot-study/${session.id}/columns`)
    } catch (err) {
      setErrorMsg('This file could not be read. Please check the format and try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
        Pilot Study &mdash; Reliability Test
      </h1>
      <p style={{ color: '#777777', fontSize: '13px', marginBottom: '24px' }}>
        Upload your pilot survey data (.xlsx, .xls, or .csv) to begin.
      </p>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '32px 20px',
          border: '1px dashed #D4AF37',
          textAlign: 'center',
        }}
      >
        <label
          htmlFor="pilot-upload"
          style={{
            display: 'inline-block',
            backgroundColor: '#D4AF37',
            color: '#333333',
            fontWeight: 700,
            fontSize: '13px',
            padding: '10px 20px',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Processing...' : 'Choose File'}
        </label>
        <input
          id="pilot-upload"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          disabled={loading}
          style={{ display: 'none' }}
        />

        {fileName && !errorMsg && (
          <p style={{ color: '#777777', fontSize: '12px', marginTop: '14px' }}>
            {fileName}
          </p>
        )}
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '16px', padding: '16px', marginTop: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      )}
    </div>
  )
}
