import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient as createServerClient } from '@/lib/supabase-server'
import { createCheckoutSession, getCustomerPortalUrl, findCustomerIdByEmail } from '@/lib/polar'

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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://my.flatlist.app'
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://my.flatlist.app'
    const returnUrl = `${siteUrl}/`

    // Get user's subscription to find customer ID
    let customerId: string | null = null
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('polar_customer_id, plan')
      .eq('user_id', user.id)
      .maybeSingle()

    customerId = subscription?.polar_customer_id ?? null

    // If we have no customer ID but user is premium (e.g. synced from Polar), look up by email
    if (!customerId && user.email) {
      customerId = await findCustomerIdByEmail(user.email)
      if (customerId && subscription) {
        // Persist so next time we have it
        await supabase
          .from('user_subscriptions')
          .update({ polar_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'No subscription found. Use Sync subscription or complete a checkout first.' },
        { status: 404 }
      )
    }

    const result = await getCustomerPortalUrl(customerId, returnUrl)

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error || 'Could not get portal URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ portalUrl: result.url })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get portal URL'
    console.error('Portal URL error:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
