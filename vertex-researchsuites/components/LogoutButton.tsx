'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push('/logout')}
      style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 50, padding: '8px 14px', background: '#ffffff', color: '#333333', border: '1px solid #D4AF37', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
    >
      Log out
    </button>
  )
}
