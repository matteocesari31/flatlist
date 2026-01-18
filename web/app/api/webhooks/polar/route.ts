import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSubscriptionActive } from '@/lib/polar'

// Create Supabase admin client for webhook handling
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Verify Polar webhook signature using Web Crypto API
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    )
    
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    const providedSignature = signature.replace('sha256=', '')
    
    return expectedSignature === providedSignature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  console.log('=== Polar Webhook Received ===')
  
  try {
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('POLAR_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }
    
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('polar-signature') || request.headers.get('x-polar-signature') || ''
    
    // Verify signature (skip in development if needed)
    if (process.env.NODE_ENV === 'production') {
      const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error('Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }
    
    // Parse the webhook payload
    const payload = JSON.parse(rawBody)
    console.log('Webhook type:', payload.type)
    console.log('Webhook data:', JSON.stringify(payload.data, null, 2))
    
    const supabase = createAdminClient()
    
    // Handle different event types
    switch (payload.type) {
      case 'subscription.created':
      case 'subscription.updated': {
        const subscription = payload.data
        const customerId = subscription.customer?.id || subscription.customer_id
        const customerEmail = subscription.customer?.email
        const isActive = isSubscriptionActive(subscription.status)
        
        console.log('Processing subscription event:', {
          subscriptionId: subscription.id,
          customerId,
          customerEmail,
          status: subscription.status,
          isActive,
        })
        
        // Get user_id from metadata or find by email
        let userId = subscription.metadata?.user_id
        
        if (!userId && customerEmail) {
          // Look up user by email
          const { data: users } = await supabase
            .from('auth.users')
            .select('id')
            .eq('email', customerEmail)
            .limit(1)
          
          // Fallback: query using auth admin API
          if (!users || users.length === 0) {
            // Try finding existing subscription by customer_id
            const { data: existingSub } = await supabase
              .from('user_subscriptions')
              .select('user_id')
              .eq('polar_customer_id', customerId)
              .maybeSingle()
            
            if (existingSub) {
              userId = existingSub.user_id
            }
          } else {
            userId = users[0].id
          }
        }
        
        if (!userId) {
          console.error('Could not find user for subscription:', customerId)
          // Still return 200 to acknowledge receipt
          return NextResponse.json({ received: true, warning: 'User not found' })
        }
        
        // Upsert subscription record
        const { error: upsertError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan: isActive ? 'premium' : 'free',
            polar_customer_id: customerId,
            polar_subscription_id: subscription.id,
            current_period_end: subscription.current_period_end,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          })
        
        if (upsertError) {
          console.error('Error upserting subscription:', upsertError)
          return NextResponse.json(
            { error: 'Database error' },
            { status: 500 }
          )
        }
        
        console.log('Subscription updated successfully for user:', userId)
        break
      }
      
      case 'subscription.canceled':
      case 'subscription.revoked': {
        const subscription = payload.data
        const customerId = subscription.customer?.id || subscription.customer_id
        
        console.log('Processing subscription cancellation:', {
          subscriptionId: subscription.id,
          customerId,
        })
        
        // Find user by customer_id and downgrade to free
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            plan: 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('polar_customer_id', customerId)
        
        if (updateError) {
          console.error('Error updating subscription:', updateError)
          return NextResponse.json(
            { error: 'Database error' },
            { status: 500 }
          )
        }
        
        console.log('Subscription canceled, user downgraded to free')
        break
      }
      
      case 'checkout.updated': {
        const checkout = payload.data
        console.log('Checkout updated:', {
          checkoutId: checkout.id,
          status: checkout.status,
        })
        
        // Checkout completion is handled by subscription.created
        // This is just for logging/tracking
        break
      }
      
      default:
        console.log('Unhandled webhook type:', payload.type)
    }
    
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Polar may send GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint active' })
}
