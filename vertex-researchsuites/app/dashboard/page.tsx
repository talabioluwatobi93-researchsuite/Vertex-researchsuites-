'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function Dashboard() {
  const [firstName, setFirstName] = useState('')
  const [greeting, setGreeting] = useState('')
  const [messages, setMessages] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')

    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        if (profile?.full_name) {
          setFirstName(profile.full_name.split(' ')[0])
        }
      }
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('banner_messages')
        .select('message')
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setMessages(data.map((row) => row.message))
      } else {
        setMessages(['Welcome to Vertex ResearchSuite — your research journey starts here.'])
      }
    }

    fetchProfile()
    fetchMessages()
  }, [])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const cardWidth = el.offsetWidth * 0.85 + 12
    const index = Math.round(el.scrollLeft / cardWidth)
    setActiveIndex(index)
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh' }}>
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ color: '#333333', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          {greeting}, {firstName || 'there'} 👋
        </h1>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          gap: '12px',
          padding: '0 20px 16px',
          scrollbarWidth: 'none',
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              flex: '0 0 85%',
              scrollSnapAlign: 'center',
              background: 'linear-gradient(135deg, #F5D485 0%, #D4AF37 50%, #B8860B 100%)',
              border: '1px solid #B8860B',
              borderRadius: '16px',
              padding: '18px 20px',
              color: '#333333',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {msg}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', paddingBottom: '20px' }}>
        {messages.map((_, i) => (
          <div
            key={i}
            style={{
              width: activeIndex === i ? '18px' : '6px',
              height: '6px',
              borderRadius: '3px',
              backgroundColor: activeIndex === i ? '#D4AF37' : '#E5D9B0',
              transition: 'all 0.2s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
