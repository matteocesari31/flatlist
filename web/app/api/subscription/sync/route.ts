import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  findCustomerIdByEmail,
  getActiveSubscriptionForCustomer,
} from '@/lib/polar'

/**
 * POST /api/subscription/sync
 * Fetches the current subscription status from Polar and updates user_subscriptions.
 * Use this if you upgraded but the UI still shows Free (e.g. webhook failed or was delayed).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const email = user.email
    if (!email) {
      return NextResponse.json(
        { error: 'User has no email' },
        { status: 400 }
      )
    }

    const customerId = await findCustomerIdByEmail(email)
    if (!customerId) {
      return NextResponse.json(
        { synced: false, message: 'No Polar customer found for this email' },
        { status: 200 }
      )
    }

    const activeSub = await getActiveSubscriptionForCustomer(customerId)
    if (!activeSub) {
      return NextResponse.json(
        { synced: true, isPremium: false, message: 'No active Premium subscription in Polar' },
        { status: 200 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const admin = createAdminClient(supabaseUrl, serviceKey)
    const { error: upsertError } = await admin
      .from('user_subscriptions')
      .upsert(
        {
          user_id: user.id,
          plan: 'premium',
          polar_customer_id: customerId,
          polar_subscription_id: activeSub.id,
          current_period_end: activeSub.current_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Subscription sync upsert error:', upsertError)
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      synced: true,
      isPremium: true,
      message: 'Subscription synced from Polar',
    })
  } catch (error: any) {
    console.error('Subscription sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Subscription sync failed' },
      { status: 500 }
    )
  }
}
