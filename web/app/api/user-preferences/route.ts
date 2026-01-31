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

// GET: Fetch user's dream apartment description
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from('user_preferences')
      .select('dream_apartment_description, updated_at')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      dream_apartment_description: data?.dream_apartment_description || null,
      updated_at: data?.updated_at || null
    })

  } catch (error: any) {
    console.error('Error in GET user-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST: Save/update user's dream apartment description
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { dream_apartment_description, trigger_comparison = true } = await req.json()

    if (typeof dream_apartment_description !== 'string') {
      return NextResponse.json(
        { error: 'Invalid dream_apartment_description' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Upsert user preferences
    const { error: upsertError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        dream_apartment_description: dream_apartment_description.trim() || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (upsertError) {
      console.error('Error saving preferences:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save preferences' },
        { status: 500 }
      )
    }

    // If description is empty, delete all comparisons for this user
    if (!dream_apartment_description.trim()) {
      await supabase
        .from('listing_comparisons')
        .delete()
        .eq('user_id', user.id)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Preferences cleared',
        comparisons_triggered: false
      })
    }

    // Trigger comparison for all listings if requested
    if (trigger_comparison) {
      try {
        const compareUrl = `${supabaseUrl}/functions/v1/compare-listing`
        
        // Fire and forget - don't wait for completion
        fetch(compareUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            user_id: user.id,
            compare_all: true 
          }),
        }).catch(err => {
          console.error('Error triggering comparison:', err)
        })

        return NextResponse.json({ 
          success: true, 
          message: 'Preferences saved, comparisons triggered',
          comparisons_triggered: true
        })
      } catch (compareError) {
        console.error('Error triggering comparison:', compareError)
        // Still return success since preferences were saved
        return NextResponse.json({ 
          success: true, 
          message: 'Preferences saved, but comparison trigger failed',
          comparisons_triggered: false
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Preferences saved',
      comparisons_triggered: false
    })

  } catch (error: any) {
    console.error('Error in POST user-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
