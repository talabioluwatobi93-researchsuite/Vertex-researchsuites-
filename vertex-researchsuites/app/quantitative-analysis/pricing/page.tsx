'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { checkFeatureAccess } from '@/lib/checkFeatureAccess'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function QuantPricingPage() {
  const router = useRouter()
  const [price, setPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('feature_pricing')
      .select('price')
      .eq('feature_name', 'quant_new_analysis')
      .single()
      .then(({ data }) => {
        setPrice(data?.price ?? 0)
      })
  }, [])

  const handleContinue = async () => {
    setLoading(true)
    setErrorMsg(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setErrorMsg('You must be signed in to continue.')
      setLoading(false)
      return
    }
    const access = await checkFeatureAccess('quant_new_analysis', user.id)
    if (!access.allowed) {
      setErrorMsg(access.message || 'Your balance is not enough, kindly top up.')
      setLoading(false)
      return
    }
    router.push('/quantitative-analysis')
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}>
      <h1>Quantitative Data Analysis</h1>
      <p style={{ opacity: 0.8 }}>
        Upload your data and get response rate checks, reliability (Cronbach's Alpha)
        analysis, full inferential statistics, and an AI-generated interpretation with
        defense-ready explanations.
      </p>
      <p style={{ fontSize: 24, fontWeight: 600, margin: '20px 0' }}>
        {price === null ? 'Loading price...' : price === 0 ? 'Free' : `₦${price}`}
      </p>
      {errorMsg && (
        <p style={{ color: '#b00020', marginBottom: 16 }}>{errorMsg}</p>
      )}
      <button onClick={handleContinue} disabled={loading || price === null}>
        {loading ? 'Checking...' : 'Continue'}
      </button>
    </div>
  )
}
