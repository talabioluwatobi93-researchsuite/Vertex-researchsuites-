'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type BunkerItem = {
  id: string
  item_name: string
  content_reference: string
  created_at: string
}

export default function Bunker() {
  const router = useRouter()
  const [items, setItems] = useState<BunkerItem[]>([])
  const [selected, setSelected] = useState<BunkerItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItems = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('bunker_items')
        .select('id, item_name, content_reference, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (data) setItems(data)
      setLoading(false)
    }

    fetchItems()
  }, [])

  if (selected) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
        <button
          onClick={() => setSelected(null)}
          style={{ backgroundColor: 'transparent', border: 'none', color: '#B8860B', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px', padding: 0 }}
        >
          ← Back to Bunker
        </button>
        <h1 style={{ color: '#333333', fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
          {selected.item_name}
        </h1>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: 0 }}>
            {selected.content_reference}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>
        📦 My Bunker
      </h1>

      {loading ? (
        <p style={{ color: '#888888', fontSize: '14px' }}>Loading...</p>
      ) : items.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px 20px', border: '1px solid #EEEEEE', textAlign: 'center' }}>
          <p style={{ color: '#888888', fontSize: '14px', margin: 0 }}>Your Bunker is empty. Generate some research topics and save them here!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #EEEEEE',
                borderRadius: '14px',
                padding: '16px 18px',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <p style={{ color: '#333333', fontSize: '14px', fontWeight: 700, margin: 0 }}>
                {item.item_name}
              </p>
              <p style={{ color: '#888888', fontSize: '12px', margin: '4px 0 0' }}>
                {new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
