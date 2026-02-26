import { supabase } from './supabase'
import { ListingWithMetadata } from '../../shared/types'
import { EDGE_FUNCTIONS } from '../../shared/constants'

export async function fetchListings(catalogIds: string[]): Promise<ListingWithMetadata[]> {
  if (catalogIds.length === 0) return []

  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_metadata(*), listing_notes(*)')
    .in('catalog_id', catalogIds)
    .order('saved_at', { ascending: false })

  if (error) throw error
  return (data as ListingWithMetadata[]) || []
}

export async function fetchUserCatalogs(userId: string) {
  const { data, error } = await supabase
    .from('catalog_members')
    .select('catalog_id, role, catalogs(id, name, created_by)')
    .eq('user_id', userId)

  if (error) throw error
  return data || []
}

export async function fetchCatalogMembers(catalogId: string) {
  const { data, error } = await supabase
    .from('catalog_members')
    .select('user_id, role')
    .eq('catalog_id', catalogId)

  if (error) throw error
  return data || []
}

export async function deleteListing(listingId: string) {
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)

  if (error) throw error
}

export async function saveListingNote(listingId: string, userId: string, note: string) {
  const { data: existing } = await supabase
    .from('listing_notes')
    .select('id')
    .eq('listing_id', listingId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('listing_notes')
      .update({ note, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('listing_notes')
      .insert({ listing_id: listingId, user_id: userId, note })
    if (error) throw error
  }
}

export async function fetchListingComparisons(
  userId: string
): Promise<Map<string, { score: number; summary: string }>> {
  const { data, error } = await supabase
    .from('listing_comparisons')
    .select('listing_id, match_score, comparison_summary')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching comparisons:', error)
    return new Map()
  }

  const map = new Map<string, { score: number; summary: string }>()
  data?.forEach((row: { listing_id: string; match_score: number; comparison_summary: string }) => {
    map.set(row.listing_id, {
      score: row.match_score,
      summary: row.comparison_summary ?? '',
    })
  })
  return map
}

export async function fetchDreamApartment(userId: string) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('dream_apartment_description')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.dream_apartment_description || null
}

export async function saveDreamApartment(userId: string, description: string) {
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('user_preferences')
      .update({ dream_apartment_description: description })
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('user_preferences')
      .insert({ user_id: userId, dream_apartment_description: description })
    if (error) throw error
  }
}

export async function compareListing(listingId: string, userId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const response = await fetch(
    `${supabaseUrl}/functions/v1/${EDGE_FUNCTIONS.COMPARE_LISTING}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ listing_id: listingId, user_id: userId }),
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to compare listing')
  }

  return response.json()
}

export async function fetchSubscription(userId: string) {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('plan, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  let isPremium = data?.plan === 'premium'
  if (isPremium && data?.current_period_end) {
    isPremium = new Date(data.current_period_end) > new Date()
  }

  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  return {
    plan: (data?.plan || 'free') as 'free' | 'premium',
    isPremium,
    listingsCount: count || 0,
    currentPeriodEnd: data?.current_period_end || null,
  }
}

export async function acceptInvitation(token: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const response = await fetch(
    `${supabaseUrl}/functions/v1/${EDGE_FUNCTIONS.SEND_INVITATION}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'accept', token }),
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to accept invitation')
  }

  return response.json()
}
