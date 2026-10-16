'use client'

import { usePathname, useRouter } from 'next/navigation'
import { backTarget } from '../lib/backMap'

export default function BackButton() {
  const router = useRouter()
  const pathname = usePathname()
  const target = backTarget(pathname || '')
  if (!target) return null
  return (
    <button
      onClick={() => router.push(target)}
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 1000,
        backgroundColor: '#ffffff',
        border: '1px solid #EEEEEE',
        borderRadius: '10px',
        padding: '8px 14px',
        fontSize: '13px',
        fontWeight: 700,
        color: '#333333',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      }}
    >
      ← Back
    </button>
  )
}
