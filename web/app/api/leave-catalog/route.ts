import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { catalogId } = body

    if (!catalogId) {
      return NextResponse.json(
        { error: 'Missing required field: catalogId' },
        { status: 400 }
      )
    }

    const { data: membership, error: membershipError } = await supabase
      .from('catalog_members')
      .select('role')
      .eq('catalog_id', catalogId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You are not a member of this catalog' },
        { status: 403 }
      )
    }

    if (membership.role === 'owner') {
      return NextResponse.json(
        { error: 'Owners cannot leave; transfer ownership or delete the catalog.' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('catalog_members')
      .delete()
      .eq('catalog_id', catalogId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error leaving catalog:', deleteError)
      return NextResponse.json(
        { error: 'Failed to leave catalog' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in leave-catalog:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
