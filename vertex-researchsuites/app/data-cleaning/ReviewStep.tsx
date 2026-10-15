'use client'

import type { Grid } from '@/lib/dataCleaning'
import { headerText } from '@/lib/dataCleaning'
import type { FlowState } from '@/lib/dataCleaningFlow'
import { codedInColumnOrder } from '@/lib/dataCleaningFlow'
import { button, buttons, card, errorBox, heading, muted, row } from './styles'

type Props = {
  grid: Grid
  flow: FlowState
  busy: boolean
  error: string
  onRedo: (col: number) => void
  onConfirm: () => void
  onRestart: () => void
}

export default function ReviewStep({ grid, flow, busy, error, onRedo, onConfirm, onRestart }: Props) {
  const coded = codedInColumnOrder(flow)
  const blocked = busy || coded.length === 0
  return (
    <div>
      <div style={card}>
        <p style={heading}>Check your numbers</p>
        <p style={muted}>
          {coded.length + ' question(s) will be changed. Nothing changes until you tap Confirm. Blank cells stay blank and your original file is not touched.'}
        </p>
        {coded.map((q) => (
          <div key={q.col} style={{ ...row, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#333333', fontSize: '14px', fontWeight: 700 }}>{q.question}</div>
              <div style={{ color: '#555555', fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>
                {q.entries.map((e) => e.label + ' = ' + e.code).join('   |   ')}
              </div>
            </div>
            <button onClick={() => onRedo(q.col)} disabled={busy} style={button('gray', busy)}>Change</button>
          </div>
        ))}
      </div>
      {flow.skipped.length > 0 && (
        <div style={card}>
          <p style={heading}>Skipped (left as words)</p>
          {flow.skipped.map((c) => (
            <div key={c} style={row}>
              <span style={{ flex: 1, color: '#333333', fontSize: '14px' }}>{headerText(grid, c)}</span>
              <button onClick={() => onRedo(c)} disabled={busy} style={button('gray', busy)}>Code this too</button>
            </div>
          ))}
        </div>
      )}
      {error && <div style={errorBox}>{error}</div>}
      <div style={buttons}>
        <button onClick={onConfirm} disabled={blocked} style={button('gold', blocked)}>
          {busy ? 'Working...' : 'Confirm and download'}
        </button>
        <button onClick={onRestart} disabled={busy} style={button('gray', busy)}>Start over</button>
      </div>
    </div>
  )
}
