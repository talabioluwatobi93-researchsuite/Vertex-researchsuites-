import type { CSSProperties } from 'react'

// Colours are the ones already used on your dashboard, Bunker and Restyle pages.
export const GOLD = '#D4AF37'

export const page: CSSProperties = { backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }
export const wrap: CSSProperties = { maxWidth: 640, margin: '0 auto' }
export const card: CSSProperties = { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '14px' }
export const title: CSSProperties = { color: '#333333', fontSize: '22px', fontWeight: 700, margin: 0 }
export const heading: CSSProperties = { color: '#333333', fontSize: '16px', fontWeight: 700, margin: '0 0 8px' }
export const label: CSSProperties = { color: '#333333', fontSize: '14px', fontWeight: 700, display: 'block', marginBottom: '6px' }
export const muted: CSSProperties = { color: '#888888', fontSize: '13px', lineHeight: 1.5, margin: '0 0 12px' }
export const note: CSSProperties = { color: '#8a6d00', fontSize: '13px', lineHeight: 1.5, margin: '0 0 12px', padding: '10px 12px', borderLeft: '4px solid #D4AF37', backgroundColor: '#F5F5F5', borderRadius: '8px' }
export const errorBox: CSSProperties = { backgroundColor: '#FDEDEC', color: '#C0392B', fontSize: '14px', borderRadius: '16px', padding: '16px 20px', marginBottom: '14px' }
export const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D4AF37', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#333333', backgroundColor: '#ffffff' }
export const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '1px solid #EEEEEE' }
export const buttons: CSSProperties = { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }
export const backLink: CSSProperties = { backgroundColor: 'transparent', border: 'none', color: '#B8860B', fontSize: '14px', fontWeight: 700, cursor: 'pointer', padding: 0 }

export const iconTile: CSSProperties = {
  width: 'clamp(44px, 6vw, 56px)',
  height: 'clamp(44px, 6vw, 56px)',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #F5D485 0%, #D4AF37 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'clamp(20px, 2.5vw, 26px)',
  flexShrink: 0,
}

export function button(kind: 'gold' | 'gray', disabled?: boolean): CSSProperties {
  return {
    backgroundColor: disabled || kind === 'gray' ? '#EEEEEE' : GOLD,
    color: disabled ? '#888888' : '#333333',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 18px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
