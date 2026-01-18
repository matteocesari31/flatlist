import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const inviteToken = requestUrl.searchParams.get('invite_token')

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    // If session was created successfully, ensure user has a subscription record
    if (data?.user && !error) {
      // Create free subscription for new users (ignore if already exists)
      const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: data.user.id,
          plan: 'free',
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: true,
        })
      
      if (subError) {
        console.warn('Could not create subscription (may already exist):', subError.message)
      }
    }
  }

  // If there's an invitation token, redirect to acceptance page
  if (inviteToken) {
    return NextResponse.redirect(new URL(`/invite/accept?token=${inviteToken}`, requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}

