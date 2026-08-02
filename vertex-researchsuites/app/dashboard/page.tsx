'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { checkFeatureAccess } from '@/lib/checkFeatureAccess'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type BannerMessage = {
  message: string
  image_url: string | null
}

export default function Dashboard() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [greeting, setGreeting] = useState('')
  const [messages, setMessages] = useState<BannerMessage[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [balance, setBalance] = useState<number | null>(null)
  const [serialId, setSerialId] = useState('')
  const [userId, setUserId] = useState('')
  const [checking, setChecking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')

    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        if (profile?.full_name) {
          setFirstName(profile.full_name.split(' ')[0])
        }

        const idPart = user.id.replace(/-/g, '').slice(0, 12).toUpperCase()
        const formatted = idPart.match(/.{1,4}/g)?.join(' ') || idPart
        setSerialId(formatted)

        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', user.id)
          .single()

        setBalance(wallet?.balance ?? 0)
      }
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('banner_messages')
        .select('message, image_url')
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setMessages(data)
      } else {
        setMessages([{ message: 'Welcome to Vertex ResearchSuite — your research journey starts here.', image_url: null }])
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

  const formattedBalance = balance !== null
    ? balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  const handleFeatureClick = async () => {
    setErrorMsg('')
    setChecking(true)
    const result = await checkFeatureAccess('research_topics', userId)
    setChecking(false)

    if (result.allowed) {
      router.push('/proposals/new')
    } else {
      setErrorMsg(result.message)
    }
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
        {messages.map((item, i) => (
          <div
            key={i}
            style={{
              flex: '0 0 85%',
              scrollSnapAlign: 'center',
              position: 'relative',
              borderRadius: '16px',
              overflow: 'hidden',
              minHeight: '140px',
              border: item.image_url ? 'none' : '1px solid #B8860B',
              background: item.image_url
                ? `url(${item.image_url}) center/cover no-repeat`
                : 'linear-gradient(135deg, #F5D485 0%, #D4AF37 50%, #B8860B 100%)',
            }}
          >
            {item.image_url ? (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '16px 18px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))',
              }}>
                <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                  {item.message}
                </p>
              </div>
            ) : (
              <div style={{ padding: '18px 20px' }}>
                <p style={{ color: '#333333', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                  {item.message}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', paddingBottom: '24px' }}>
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

      <div style={{ padding: '0 20px 30px' }}>
        <div style={{
          borderRadius: '20px',
          padding: '24px',
          background: 'linear-gradient(135deg, #F5D485 0%, #D4AF37 45%, #9C7A16 100%)',
          boxShadow: '0 8px 20px rgba(184, 134, 11, 0.35)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
            <span style={{ color: '#333333', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
              VERTEX RESEARCHSUITE
            </span>
            <span style={{ color: '#333333', fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>
              ● ● ●
            </span>
          </div>

          <div style={{ marginTop: '28px' }}>
            <p style={{ color: '#333333', fontSize: '11px', fontWeight: 600, margin: 0, opacity: 0.7, letterSpacing: '0.5px' }}>
              WALLET BALANCE
            </p>
            <p style={{ color: '#333333', fontSize: '28px', fontWeight: 800, margin: '4px 0 0' }}>
              ₦{formattedBalance}
            </p>
          </div>

          <div style={{
            marginTop: '22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}>
            <div>
              <p style={{ color: '#333333', fontSize: '10px', fontWeight: 600, margin: 0, opacity: 0.6, letterSpacing: '0.5px' }}>
                SERIAL ID
              </p>
              <p style={{ color: '#333333', fontSize: '14px', fontWeight: 700, margin: '2px 0 0', letterSpacing: '1px' }}>
                {serialId || '•••• •••• ••••'}
              </p>
            </div>

            <button style={{
              backgroundColor: '#333333',
              color: '#D4AF37',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}>
              Top Up
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 40px' }}>
        <button
          onClick={handleFeatureClick}
          disabled={checking}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #EEEEEE',
            borderRadius: '16px',
            padding: '18px 20px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #F5D485 0%, #D4AF37 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            flexShrink: 0,
          }}>
            📚
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#333333', fontSize: '15px', fontWeight: 700, margin: 0 }}>
              Get Research Topics & Proposals
            </p>
            <p style={{ color: '#888888', fontSize: '12px', margin: '2px 0 0' }}>
              {checking ? 'Checking...' : 'Tailored to your course and institution'}
            </p>
          </div>
          <span style={{ color: '#B8860B', fontSize: '18px' }}>›</span>
        </button>

        {errorMsg && (
          <p style={{ color: '#C0392B', fontSize: '13px', fontWeight: 600, marginTop: '10px', textAlign: 'center' }}>
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  )
}
