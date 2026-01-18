import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient as createServerClient } from '@/lib/supabase-server'
import { createCheckoutSession, getCustomerPortalUrl } from '@/lib/polar'

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
    
    // Get request body
    const body = await request.json()
    const { returnUrl } = body
    
    // Build success URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const successUrl = returnUrl || `${siteUrl}/?checkout=success`
    
    // Create checkout session
    const { checkoutUrl, checkoutId } = await createCheckoutSession(
      user.email || '',
      user.id,
      successUrl
    )
    
    return NextResponse.json({
      checkoutUrl,
      checkoutId,
    })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

// GET endpoint to get customer portal URL for managing subscription
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
    
    // Get user's subscription to find customer ID
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('polar_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (!subscription?.polar_customer_id) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      )
    }
    
    // Get customer portal URL
    const portalUrl = await getCustomerPortalUrl(subscription.polar_customer_id)
    
    if (!portalUrl) {
      return NextResponse.json(
        { error: 'Could not get portal URL' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ portalUrl })
  } catch (error: any) {
    console.error('Portal URL error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get portal URL' },
      { status: 500 }
    )
  }
}
