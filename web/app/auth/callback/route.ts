import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const inviteToken = requestUrl.searchParams.get('invite_token')

  if (code) {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // If there's an invitation token, redirect to acceptance page
  if (inviteToken) {
    return NextResponse.redirect(new URL(`/invite/accept?token=${inviteToken}`, requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}

