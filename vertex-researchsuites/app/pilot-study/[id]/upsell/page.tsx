'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import jsPDF from 'jspdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function PilotStudyUpsellPage() {
  const { id } = useParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [promoCode, setPromoCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [reportData, setReportData] = useState<any>(null)

  useEffect(() => {
    loadPromoCode()
  }, [id])

  async function loadPromoCode() {
    setLoading(true)
    setErrorMsg('')

    const { data: sessionData, error: sessionError } = await supabase
      .from('pilot_study_sessions')
      .select('user_id, results, interpretation, citation_style')
      .eq('id', id)
      .single()

    if (sessionError || !sessionData) {
      setErrorMsg('Could not load your offer. Please try again.')
      setLoading(false)
      return
    }

    const { data: promoData, error: promoError } = await supabase
      .from('user_promo_codes')
      .select('code, expires_at')
      .eq('user_id', sessionData.user_id)
      .eq('status', 'active')
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (promoError || !promoData) {
      setErrorMsg('Your discount code could not be found. It may have already been used or expired.')
      setLoading(false)
      return
    }

    setReportData(sessionData)
    setPromoCode(promoData.code)
    setExpiresAt(promoData.expires_at)
    setLoading(false)
  }

  function copyCode() {
    if (!promoCode) return
    navigator.clipboard.writeText(promoCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  function downloadPDF() {
    if (!reportData) return
    const doc = new jsPDF()
    let y = 20
    doc.setFontSize(16)
    doc.text('Pilot Study Reliability & Validity Report', 14, y)
    y += 10
    doc.setFontSize(10)
    doc.text(`Citation Style: ${reportData.citation_style || 'APA7'}`, 14, y)
    y += 10

    let interp: any = {}
    try {
      interp = typeof reportData.interpretation === 'string' ? JSON.parse(reportData.interpretation) : reportData.interpretation
    } catch {
      interp = {}
    }
    const report = interp?.pilot_study_report

    const addSection = (title: string, text: string) => {
      if (!text) return
      doc.setFontSize(12)
      doc.text(title, 14, y)
      y += 6
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(text, 180)
      doc.text(lines, 14, y)
      y += lines.length * 5 + 6
      if (y > 270) { doc.addPage(); y = 20 }
    }

    addSection('Reliability Overview', report?.reliability_overview || '')
    addSection('Validity Discussion', report?.validity_discussion || '')

    if (report?.construct_evaluations?.length) {
      doc.setFontSize(12)
      doc.text('Construct Evaluations', 14, y)
      y += 6
      doc.setFontSize(10)
      report.construct_evaluations.forEach((c: any) => {
        const line = `${c.construct_name} - ${c.alpha_score} (${c.status}): ${c.action_required}`
        const l = doc.splitTextToSize(line, 180)
        doc.text(l, 14, y)
        y += l.length * 5 + 4
        if (y > 270) { doc.addPage(); y = 20 }
      })
      y += 4
    }

    if (report?.defense_prep_questions?.length) {
      doc.setFontSize(12)
      doc.text('Defense Prep Questions', 14, y)
      y += 6
      doc.setFontSize(10)
      report.defense_prep_questions.forEach((q: any, i: number) => {
        const ql = doc.splitTextToSize(`Q${i + 1}: ${q.question}`, 180)
        doc.text(ql, 14, y)
        y += ql.length * 5 + 2
        const al = doc.splitTextToSize(`A: ${q.answer}`, 180)
        doc.text(al, 14, y)
        y += al.length * 5 + 6
        if (y > 270) { doc.addPage(); y = 20 }
      })
    }

    doc.save('Pilot_Study_Report.pdf')
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#777777' }}>
        Loading your offer...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#333333', marginBottom: '4px' }}>
        Ready for the Full Analysis?
      </h1>
      <p style={{ fontSize: '13px', color: '#777777', marginBottom: '24px' }}>
        Your Pilot Study is complete. Here's what's next.
      </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #EEEEEE', marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#333333', marginBottom: '10px' }}>Quantitative Analysis — ₦10,000</p>
        <ul style={{ paddingLeft: '18px', margin: 0, color: '#555555', fontSize: '13px', lineHeight: '1.8' }}>
          <li>Full demographic profile and item-level construct analysis</li>
          <li>Correlation and regression analysis, fully expanded tables and charts</li>
          <li>Complete Chapter 4 and Chapter 5 — ready to submit</li>
          <li>Defense preparation questions tailored to your exact results</li>
        </ul>
      </div>

      {errorMsg ? (
        <div style={{ backgroundColor: '#FDEDEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFF8E7', border: '1px solid #D4AF37', borderRadius: '16px', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#333333', fontWeight: 600, marginBottom: '8px' }}>
            Your exclusive 10% discount code
          </p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: '#333333', letterSpacing: '2px', margin: '8px 0' }}>
            {promoCode}
          </p>
          <button
            onClick={copyCode}
            style={{ backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <p style={{ fontSize: '11px', color: '#999999', marginTop: '10px' }}>
            Valid until {formattedExpiry}. This code is unique to your account and can only be used once. Running another Pilot Study will replace it with a new one.
          </p>
        </div>
      )}

        <button
          onClick={downloadPDF}
          style={{ width: '100%', backgroundColor: '#D4AF37', color: '#333333', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px' }}
        >
          Download Report (PDF)
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ width: '100%', backgroundColor: 'transparent', color: '#777777', border: '1px solid #EEEEEE', borderRadius: '10px', padding: '12px', fontSize: '13px', cursor: 'pointer' }}
        >
          Go to Dashboard
        </button>
    </div>
  )
}
