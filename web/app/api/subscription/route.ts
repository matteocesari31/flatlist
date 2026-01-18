import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { UserSubscription, SubscriptionPlan } from '@/lib/types'

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
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    
    // If no subscription exists, user is on free plan
    const plan: SubscriptionPlan = subscription?.plan || 'free'
    
    // Check if premium is still active (not expired)
    let isPremium = plan === 'premium'
    if (isPremium && subscription?.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end)
      isPremium = periodEnd > new Date()
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
