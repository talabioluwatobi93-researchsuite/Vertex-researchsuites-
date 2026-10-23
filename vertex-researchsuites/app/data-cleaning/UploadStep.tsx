'use client'

import { useState } from 'react'
import { columnProblem, distinctWords, findColumns, headerText, isBlank } from '@/lib/dataCleaning'
import type { LoadedSheet } from '@/lib/dataCleaningFile'
import { button, card, errorBox, input, label, muted, note, row } from './styles'

type Props = {
  fileName: string
  sheet: LoadedSheet | null
  error: string
  onFile: (file: File) => void
  onSheet: (name: string) => void
  onStart: (col: number) => void
}

export default function UploadStep({ fileName, sheet, error, onFile, onSheet, onStart }: Props) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<number[]>([])
  const [message, setMessage] = useState('')

  function choose(col: number) {
    if (!sheet) return
    const problem = columnProblem(distinctWords(sheet.grid, col))
    if (problem) {
      setMatches([])
      setMessage(problem + ' Type a different question.')
      return
    }
    onStart(col)
  }

  function handleFind() {
    if (!sheet) return
    setMessage('')
    const found = findColumns(sheet.grid, query)
    if (found.length === 0) {
      setMatches([])
      setMessage('No column matches "' + query.trim() + '". Check the spelling. Capital letters do not matter.')
    } else if (found.length === 1) {
      setMatches([])
      choose(found[0])
    } else {
      setMatches(found)
      setMessage('More than one column matches. Tap the right one.')
    }
  }

  const headers = sheet ? (sheet.grid[0] || []).map((_h, c) => headerText(sheet.grid, c)).filter((h) => h !== '') : []
  const respondents = sheet ? sheet.grid.slice(1).filter((r) => Array.isArray(r) && r.some((c) => !isBlank(c))).length : 0
  const preview = headers.slice(0, 6).map((h) => (h.length > 40 ? h.slice(0, 40) + '...' : h)).join('  |  ')

  return (
    <div>
      <div style={card}>
        <label style={label}>1. Upload your Excel file</label>
        <p style={muted}>.xlsx or .xls. Your file is read on your device.</p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0]
            if (f) onFile(f)
          }}
          style={{ fontSize: '14px', color: '#333333', width: '100%' }}
        />
      </div>
      {error && <div style={errorBox}>{error}</div>}
      {sheet && (
        <div style={card}>
          <label style={label}>{fileName}</label>
          <p style={muted}>
            {respondents} rows of answers and {headers.length} columns found. Columns start with: {preview}
            {headers.length > 6 ? '  ...' : ''}
          </p>
          {sheet.sheetNames.length > 1 && (
            <div style={{ marginBottom: '14px' }}>
              <label style={label}>Sheet to clean</label>
              <select value={sheet.sheetName} onChange={(e) => onSheet(e.target.value)} style={input}>
                {sheet.sheetNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
          <label style={label}>2. Type your first question</label>
          <p style={muted}>
            Type the name of your first question as it is in your file. The app finds it and every question after it.
          </p>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="First question" style={input} />
          <div style={{ marginTop: '12px' }}>
            <button onClick={handleFind} disabled={query.trim() === ''} style={button('gold', query.trim() === '')}>
              Find my questions
            </button>
          </div>
          {message && <p style={{ ...note, marginTop: '12px', marginBottom: 0 }}>{message}</p>}
          {matches.map((c) => (
            <div key={c} style={row}>
              <span style={{ flex: 1, color: '#333333', fontSize: '14px' }}>{headerText(sheet.grid, c)}</span>
              <button onClick={() => choose(c)} style={button('gold')}>Use this</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
