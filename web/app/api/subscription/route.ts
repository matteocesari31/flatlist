import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { UserSubscription, SubscriptionPlan } from '@/lib/types'
import { findCustomerIdByEmail, getActiveSubscriptionForCustomer } from '@/lib/polar'

export interface SubscriptionResponse {
  plan: SubscriptionPlan
  isPremium: boolean
  listingsCount: number
  listingsLimit: number
  canInvite: boolean
  currentPeriodEnd: string | null
  polarCustomerId: string | null
}

const FREE_LISTINGS_LIMIT = 12

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const plan: SubscriptionPlan = subscription?.plan || 'free'
    let isPremium = plan === 'premium'
    if (isPremium && subscription?.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end)
      isPremium = periodEnd > new Date()
    }

    // Auto-sync from Polar when we think the user might have upgraded (stored plan is free)
    if (!isPremium && user.email) {
      try {
        const customerId = await findCustomerIdByEmail(user.email)
        if (customerId) {
          const activeSub = await getActiveSubscriptionForCustomer(customerId)
          if (activeSub) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
            if (supabaseUrl && serviceKey) {
              const admin = createAdminClient(supabaseUrl, serviceKey)
              await admin
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
              const { data: updated } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()
              subscription = updated ?? subscription
              isPremium = true
            }
          }
        }
      } catch (syncErr) {
        // Non-fatal: return DB state if Polar sync fails
        console.warn('Subscription auto-sync failed:', syncErr)
      }
    }

    // Count user's listings
    const { count: listingsCount, error: countError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    
    const response: SubscriptionResponse = {
      plan: isPremium ? 'premium' : 'free',
      isPremium,
      listingsCount: listingsCount || 0,
      listingsLimit: isPremium ? -1 : FREE_LISTINGS_LIMIT, // -1 means unlimited
      canInvite: isPremium,
      currentPeriodEnd: subscription?.current_period_end || null,
      polarCustomerId: subscription?.polar_customer_id || null,
    }
    
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

// POST endpoint to create initial free subscription for new users
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Check if subscription already exists
    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (existing) {
      return NextResponse.json(
        { message: 'Subscription already exists' },
        { status: 200 }
      )
    }
    
    // Create free subscription
    const { error: insertError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan: 'free',
      })
    
    if (insertError) {
      console.error('Error creating subscription:', insertError)
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Free subscription created',
      plan: 'free',
    })
  } catch (error: any) {
    console.error('Subscription creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}
