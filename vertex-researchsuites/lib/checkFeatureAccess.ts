import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function checkFeatureAccess(featureName: string, userId: string) {
  try {
    const { data: pricing } = await supabase
      .from('feature_pricing')
      .select('price')
      .eq('feature_name', featureName)
      .single()

    const price = pricing?.price ?? 0

    if (price === 0) {
      return { allowed: true, message: '' }
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single()

    const balance = wallet?.balance ?? 0

    if (balance >= price) {
      await supabase
        .from('wallets')
        .update({ balance: balance - price })
        .eq('user_id', userId)

      return { allowed: true, message: '' }
    } else {
      return { allowed: false, message: 'Your balance is not enough, kindly top up.' }
    }
  } catch {
    return { allowed: true, message: '' }
  }
}
