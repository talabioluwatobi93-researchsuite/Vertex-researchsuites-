import type { Gate } from '@/lib/jobGate'

// Finds the user's open, unexpired purchase for a feature (no job id needed).
export async function checkOpenJob(db: any, userId: string, feature: string): Promise<Gate> {
  const { data: p, error: pe } = await db.from('feature_pricing').select('price').eq('feature_name', feature).maybeSingle()
  if (pe) return { ok: false, error: 'Could not check pricing. Please try again.', status: 500 }
  const price = Number((p && p.price) || 0)
  if (!(price > 0)) return { ok: true, jobId: null }
  const { data: rows, error: je } = await db
    .from('feature_jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('status', 'open')
    .gt('deadline_at', new Date().toISOString())
    .order('deadline_at', { ascending: false })
    .limit(1)
  if (je) return { ok: false, error: 'Could not check your purchase. Please try again.', status: 500 }
  if (!rows || rows.length === 0) return { ok: false, error: 'Please accept the package first.', status: 402 }
  return { ok: true, jobId: rows[0].id }
}
