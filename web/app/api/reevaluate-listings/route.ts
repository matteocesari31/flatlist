import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Helper to get authenticated user
async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

// POST: Trigger re-evaluation of all listings for the user
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { listing_id } = await req.json().catch(() => ({}))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const compareUrl = `${supabaseUrl}/functions/v1/compare-listing`
    
    // Call compare-listing function
    const response = await fetch(compareUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(listing_id 
        ? { user_id: user.id, listing_id } 
        : { user_id: user.id, compare_all: true }
      ),
    })

    const responseText = await response.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { message: responseText }
    }

    if (!response.ok) {
      // Check if it's the "no description" error
      if (responseData.code === 'NO_DESCRIPTION') {
        return NextResponse.json(
          { error: 'No dream apartment description set', code: 'NO_DESCRIPTION' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: responseData.error || 'Failed to trigger comparison', details: responseData.details },
        { status: response.status }
      )
    }

    return NextResponse.json({ 
      success: true, 
      compared: responseData.compared || 0,
      total: responseData.total || 0,
      message: `Compared ${responseData.compared || 0} listings`
    })

  } catch (error: any) {
    console.error('Error in reevaluate-listings API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
