import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { catalogId, userId: memberToRemove } = body

    if (!catalogId || !memberToRemove) {
      return NextResponse.json(
        { error: 'Missing required fields: catalogId and userId' },
        { status: 400 }
      )
    }

    // Prevent removing yourself through this endpoint
    if (memberToRemove === user.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself. Use the leave catalog option instead.' },
        { status: 400 }
      )
    }

    // Check if current user is an owner of this catalog
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

    if (membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only catalog owners can remove members' },
        { status: 403 }
      )
    }

    // Remove the member
    const { error: deleteError } = await supabase
      .from('catalog_members')
      .delete()
      .eq('catalog_id', catalogId)
      .eq('user_id', memberToRemove)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in remove-collaborator:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
