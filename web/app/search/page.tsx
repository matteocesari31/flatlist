'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { ListingWithMetadata } from '@/lib/types'
import { parseSearchQuery, generateExplanation, SearchFilters } from '@/lib/ai-search'
import { findReferencePoint, filterByDistance } from '@/lib/geocoding'
import ListingCard from '@/components/ListingCard'
import { useRouter } from 'next/navigation'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [listings, setListings] = useState<ListingWithMetadata[]>([])
  const [explanation, setExplanation] = useState('')
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const searchTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth')
        return
      }
      setUser(user)
    })
  }, [router])

  // Auto-resize search textarea - only grow if content exceeds single line
  useEffect(() => {
    const textarea = searchTextareaRef.current
    if (textarea) {
      // Reset height to get accurate scrollHeight
      textarea.style.height = 'auto'
      // Set height to scrollHeight (will be single line height if text fits, or more if it wraps)
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [query])

  const performSearch = async () => {
    if (!query.trim()) {
      return
    }

    setLoading(true)
    setListings([])
    setExplanation('')

    try {
      const supabase = createClient()

      // Get OpenAI API key from environment (in production, this should be via API route)
      // For MVP, we'll use a client-side approach with an API route
      const response = await fetch('/api/parse-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      let filters: SearchFilters = {}
      let queryExplanation = query

      if (response.ok) {
        const data = await response.json()
        filters = data.filters || {}
        queryExplanation = data.explanation || query
      }

      // Build Supabase query - query listing_metadata and join listings
      // First, get all enriched listings
      const { data: enrichedListings, error: listingsError } = await supabase
        .from('listings')
        .select('id')
        .eq('enrichment_status', 'done')

      if (listingsError) {
        throw listingsError
      }

      const enrichedListingIds = (enrichedListings || []).map((l: any) => l.id)

      if (enrichedListingIds.length === 0) {
        setListings([])
        setExplanation('No enriched listings found. Save and wait for AI enrichment to complete.')
        setLoading(false)
        return
      }

      let metadataQuery = supabase
        .from('listing_metadata')
        .select(`
          *,
          listings!inner (*)
        `)
        .in('listing_id', enrichedListingIds)

      // Apply filters on metadata
      if (filters.noise_level) {
        metadataQuery = metadataQuery.eq('noise_level', filters.noise_level)
      }
      if (filters.student_friendly !== undefined) {
        metadataQuery = metadataQuery.eq('student_friendly', filters.student_friendly)
      }
      if (filters.natural_light) {
        metadataQuery = metadataQuery.eq('natural_light', filters.natural_light)
      }
      if (filters.floor_type) {
        metadataQuery = metadataQuery.eq('floor_type', filters.floor_type)
      }
      if (filters.renovation_state) {
        metadataQuery = metadataQuery.eq('renovation_state', filters.renovation_state)
      }
      if (filters.price_max) {
        metadataQuery = metadataQuery.lte('price', filters.price_max)
      }
      if (filters.price_min) {
        metadataQuery = metadataQuery.gte('price', filters.price_min)
      }
      if (filters.size_sqm_min) {
        metadataQuery = metadataQuery.gte('size_sqm', filters.size_sqm_min)
      }
      if (filters.rooms_min) {
        metadataQuery = metadataQuery.gte('rooms', filters.rooms_min)
      }

      // Location keywords: search in address field
      if (filters.location_keywords && filters.location_keywords.length > 0) {
        // Build OR conditions for location keywords using ilike
        const locationOrConditions = filters.location_keywords
          .map(keyword => `address.ilike.%${keyword}%`)
          .join(',')
        metadataQuery = metadataQuery.or(locationOrConditions)
      }

      // Execute query
      const { data: metadataData, error } = await metadataQuery

      if (error) {
        throw error
      }

      // Transform data to match ListingWithMetadata format
      let listingsData = (metadataData || []).map((item: any) => ({
        ...item.listings,
        listing_metadata: [item]
      }))

      // Apply distance filtering if specified (async geocoding)
      if (filters.distance_max && filters.distance_reference) {
        const referencePoint = await findReferencePoint(filters.distance_reference)
        if (referencePoint) {
          console.log('Filtering by distance:', {
            reference: referencePoint.name,
            maxDistance: filters.distance_max,
            totalListings: listingsData.length
          })
          
          const filteredWithDistance = filterByDistance(
            listingsData,
            referencePoint,
            filters.distance_max
          )
          
          listingsData = filteredWithDistance.map(item => item.listing)
          console.log('Listings after distance filter:', listingsData.length)
        } else {
          console.warn('Could not geocode reference:', filters.distance_reference)
        }
      }

      // Sort by saved_at first (most recent first)
      listingsData.sort((a: any, b: any) => {
        return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
      })

      // Simple ranking: count matched filters
      const rankedListings = listingsData.map((listing: ListingWithMetadata) => {
        const metadata = listing.listing_metadata?.[0]
        let matchCount = 0

        if (filters.noise_level && metadata?.noise_level === filters.noise_level) matchCount++
        if (filters.student_friendly !== undefined && metadata?.student_friendly === filters.student_friendly) matchCount++
        if (filters.natural_light && metadata?.natural_light === filters.natural_light) matchCount++
        if (filters.floor_type && metadata?.floor_type === filters.floor_type) matchCount++
        if (filters.renovation_state && metadata?.renovation_state === filters.renovation_state) matchCount++
        if (filters.price_max && metadata?.price && metadata.price <= filters.price_max) matchCount++
        if (filters.price_min && metadata?.price && metadata.price >= filters.price_min) matchCount++
        if (filters.size_sqm_min && metadata?.size_sqm && metadata.size_sqm >= filters.size_sqm_min) matchCount++
        if (filters.rooms_min && metadata?.rooms && metadata.rooms >= filters.rooms_min) matchCount++

        return { ...listing, matchCount }
      })

      // Sort by match count (descending), then by recency
      rankedListings.sort((a: any, b: any) => {
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount
        }
        return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
      })

      setListings(rankedListings)
      setExplanation(generateExplanation(filters, rankedListings.length))

    } catch (error: any) {
      console.error('Search error:', error)
      console.error('Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      })
      setExplanation(`Error performing search: ${error?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCardClick = (listing: ListingWithMetadata) => {
    window.open(listing.source_url, '_blank')
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <a href="/">
              <img src="/logo.svg" alt="flatlist" className="h-10" />
            </a>
            <a
              href="/"
              className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back to Catalog
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Search Listings</h1>

          <div className="mb-6">
            <div className="flex gap-2">
              <textarea
                ref={searchTextareaRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  // Auto-resize on input
                  setTimeout(() => {
                    const textarea = searchTextareaRef.current
                    if (textarea) {
                      textarea.style.height = 'auto'
                      textarea.style.height = `${textarea.scrollHeight}px`
                    }
                  }, 0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    performSearch()
                  }
                }}
                placeholder="e.g., Quiet apartments for students near M2 under 900€"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none overflow-hidden max-h-[200px]"
                rows={1}
                style={{ lineHeight: '1.5', height: 'auto' }}
              />
              <button
                onClick={performSearch}
                disabled={loading || !query.trim()}
                className="px-6 py-2 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed btn-primary"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Use natural language to search your saved listings
            </p>
          </div>

          {explanation && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900">{explanation}</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="text-lg">Searching...</div>
            </div>
          )}

          {!loading && listings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Results ({listings.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onClick={() => handleCardClick(listing)}
                  />
                ))}
              </div>
            </div>
          )}

          {!loading && query && listings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No listings match your search</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

