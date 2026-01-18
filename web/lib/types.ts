export type EnrichmentStatus = 'pending' | 'processing' | 'done' | 'failed'
export type InvitationStatus = 'pending' | 'accepted' | 'declined'
export type SubscriptionPlan = 'free' | 'premium'
export type CatalogMemberRole = 'owner' | 'editor' | 'commenter'

export interface Catalog {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface CatalogMember {
  id: string
  catalog_id: string
  user_id: string
  role: CatalogMemberRole
  joined_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan: SubscriptionPlan
  polar_customer_id: string | null
  polar_subscription_id: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface CatalogInvitation {
  id: string
  catalog_id: string
  invited_by: string
  invited_email: string
  token: string
  status: InvitationStatus
  created_at: string
  expires_at: string
}

export interface ListingNote {
  id: string
  listing_id: string
  user_id: string
  note: string
  created_at: string
  updated_at: string
}

export interface Listing {
  id: string
  user_id: string
  catalog_id: string
  source_url: string
  title: string | null
  raw_content: string
  images: string[] | null
  enrichment_status: EnrichmentStatus
  notes: string | null // Deprecated - use listing_notes instead
  saved_at: string
  created_at: string
  updated_at: string
}

export interface ListingMetadata {
  id: string
  listing_id: string
  price: number | null
  address: string | null
  latitude: number | null
  longitude: number | null
  size_sqm: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  beds_single: number | null
  beds_double: number | null
  furnishing: string | null
  condo_fees: number | null
  student_friendly: boolean | null
  floor_type: string | null
  natural_light: string | null
  noise_level: string | null
  renovation_state: string | null
  pet_friendly: boolean | null
  balcony: boolean | null
  listing_type: string | null // 'rent' or 'sale'
  vibe_tags: string[]
  evidence: Record<string, string>
  created_at: string
  updated_at: string
}

export interface ListingWithMetadata extends Listing {
  listing_metadata: ListingMetadata[]
  listing_notes?: ListingNote[] // Per-user notes
  distanceFromReference?: number // Distance in km from search reference point
}

