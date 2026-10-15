'use client'

import { button, buttons, card, heading, muted } from './styles'

export interface DoneInfo {
  name: string
  blob: Blob
  replaced: number
  unmapped: number
  codebookSheet: string
  saveStatus: 'saving' | 'saved' | 'failed'
  saveMessage: string
}

type Props = {
  info: DoneInfo
  onDownloadAgain: () => void
  onBunker: () => void
  onAnother: () => void
}

export default function DoneStep({ info, onDownloadAgain, onBunker, onAnother }: Props) {
  return (
    <div style={card}>
      <p style={heading}>Your cleaned file is ready</p>
      <p style={{ ...muted, color: '#333333' }}>
        {info.name + ' was sent to your device. ' + info.replaced + ' answers were changed to numbers. A sheet called "' + info.codebookSheet + '" lists every word and its number.'}
      </p>
      {info.unmapped > 0 && (
        <p style={{ ...muted, color: '#C0392B' }}>
          {info.unmapped + ' answers had no number and were left as words. Please check your file.'}
        </p>
      )}
      {info.saveStatus === 'saving' && <p style={muted}>Saving a copy to your Bunker...</p>}
      {info.saveStatus === 'saved' && (
        <p style={{ ...muted, color: '#1a6b2a', fontWeight: 700 }}>A copy is saved in your Bunker.</p>
      )}
      {info.saveStatus === 'failed' && (
        <p style={{ ...muted, color: '#C0392B' }}>
          {'Not saved to your Bunker: ' + info.saveMessage + ' Your download is not affected.'}
        </p>
      )}
      <div style={buttons}>
        <button onClick={onDownloadAgain} style={button('gold')}>Download again</button>
        <button onClick={onBunker} style={button('gray')}>Open my Bunker</button>
        <button onClick={onAnother} style={button('gray')}>Clean another file</button>
      </div>
    </div>
  )
}
