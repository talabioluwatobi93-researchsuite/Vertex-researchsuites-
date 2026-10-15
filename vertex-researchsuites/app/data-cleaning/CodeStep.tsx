'use client'

import { useMemo, useState } from 'react'
import type { CodedQuestion, Grid } from '@/lib/dataCleaning'
import {
  buildCoded, copyCodes, distinctWords, findIdenticalCoded, headerText,
  looksLikeFreeText, multiAnswerCells, parseCode, validateCodes,
} from '@/lib/dataCleaning'
import type { FlowState } from '@/lib/dataCleaningFlow'
import { currentCol, totalQuestions } from '@/lib/dataCleaningFlow'
import { button, buttons, card, heading, input, muted, note, row } from './styles'

type Props = {
  grid: Grid
  flow: FlowState
  onAccept: (q: CodedQuestion) => void
  onSkip: () => void
}

// One question at a time. The page gives this a new key for every question.
export default function CodeStep({ grid, flow, onAccept, onSkip }: Props) {
  const col = currentCol(flow) as number
  const words = useMemo(() => distinctWords(grid, col), [grid, col])
  const same = useMemo(() => findIdenticalCoded(words, flow.coded), [words, flow.coded])
  const [askSame, setAskSame] = useState(true)
  const [codes, setCodes] = useState<string[]>(() => words.map(() => ''))
  const question = headerText(grid, col)
  const progress = 'Question ' + (flow.coded.length + flow.skipped.length + 1) + ' of ' + totalQuestions(flow)

  function applySame() {
    if (!same) return
    const q = buildCoded(col, question, words, copyCodes(words, same))
    if (q) onAccept(q)
  }

  if (same && askSame) {
    return (
      <div style={card}>
        <p style={muted}>{progress}</p>
        <p style={heading}>{question}</p>
        <p style={{ ...muted, color: '#333333' }}>
          {'These options are the same as in "' + same.question + '". Use the same numbers?'}
        </p>
        {same.entries.map((e) => (
          <div key={e.key} style={row}>
            <span style={{ flex: 1, color: '#333333', fontSize: '14px' }}>{e.label}</span>
            <span style={{ color: '#B8860B', fontSize: '14px', fontWeight: 700 }}>{e.code}</span>
          </div>
        ))}
        <div style={buttons}>
          <button onClick={applySame} style={button('gold')}>Yes, use the same numbers</button>
          <button onClick={() => setAskSame(false)} style={button('gray')}>No, I will type them</button>
          <button onClick={onSkip} style={button('gray')}>Skip this question</button>
        </div>
      </div>
    )
  }

  const check = validateCodes(words, codes)
  const dupes = check.duplicates.map((g) => g.map((i) => words[i].label).join(', '))
  const multi = multiAnswerCells(words)
  const pending = check.missing.length + check.invalid.length

  return (
    <div style={card}>
      <p style={muted}>{progress}</p>
      <p style={heading}>{question}</p>
      <p style={muted}>
        Type the number for each answer, exactly as in your questionnaire. For example, if Female is the first option, type 1.
      </p>
      {looksLikeFreeText(words) && (
        <p style={note}>
          {'This column has ' + words.length + ' different answers, so it may be free text. Skip it unless it is a real question with fixed options.'}
        </p>
      )}
      {multi > 0 && (
        <p style={note}>
          {multi + ' answer(s) contain a comma or semicolon. Each full answer is treated as one answer. Nothing is split.'}
        </p>
      )}
      {words.map((w, i) => {
        const bad = codes[i] !== '' && parseCode(codes[i]) === null
        return (
          <div key={w.key} style={row}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#333333', fontSize: '14px', fontWeight: 700 }}>{w.label}</div>
              <div style={{ color: '#888888', fontSize: '12px' }}>{w.count + (w.count === 1 ? ' answer' : ' answers')}</div>
            </div>
            <input
              value={codes[i]}
              inputMode="decimal"
              placeholder="Number"
              onChange={(e) => setCodes(codes.map((c, j) => (j === i ? e.target.value : c)))}
              style={{ ...input, width: '96px', border: bad ? '1px solid #C0392B' : '1px solid #D4AF37' }}
            />
          </div>
        )
      })}
      {dupes.length > 0 && (
        <p style={{ ...note, marginTop: '12px', marginBottom: 0 }}>
          {'The same number is used for: ' + dupes.join(' | ') + '. Continue only if your questionnaire does this.'}
        </p>
      )}
      {pending > 0 && <p style={{ ...muted, marginTop: '12px', marginBottom: 0 }}>{pending + ' answer(s) still need a valid number.'}</p>}
      <div style={buttons}>
        <button
          disabled={!check.ok}
          onClick={() => {
            const q = buildCoded(col, question, words, codes)
            if (q) onAccept(q)
          }}
          style={button('gold', !check.ok)}
        >
          Save numbers and continue
        </button>
        <button onClick={onSkip} style={button('gray')}>Skip this question</button>
      </div>
    </div>
  )
}
