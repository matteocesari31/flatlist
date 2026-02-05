'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { syncTokensToExtension } from '@/lib/extension-sync'
import { ListingWithMetadata } from '@/lib/types'
import { parseSearchQuery, generateExplanation, SearchFilters } from '@/lib/ai-search'
import { filterByDistance } from '@/lib/geocoding'
import { ConfirmedLocation } from '@/lib/use-location-detection'
import ListingCard from '@/components/ListingCard'
import MetadataViewer from '@/components/MetadataViewer'
import InviteCollaboratorModal from '@/components/InviteCollaboratorModal'
import UpgradeModal from '@/components/UpgradeModal'
import { useRouter } from 'next/navigation'
import { getUserColor } from '@/lib/user-colors'
import { SubscriptionPlan } from '@/lib/types'
import { MessageCircle, House } from 'lucide-react'
import DreamApartmentModal from '@/components/DreamApartmentModal'

interface SubscriptionInfo {
  plan: SubscriptionPlan
  isPremium: boolean
  listingsCount: number
  listingsLimit: number
  canInvite: boolean
  currentPeriodEnd: string | null
}

export default function Home() {
  const [listings, setListings] = useState<ListingWithMetadata[]>([])
  const [allListings, setAllListings] = useState<ListingWithMetadata[]>([]) // Store all listings
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchExplanation, setSearchExplanation] = useState('')
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({})
  const [searchResultCount, setSearchResultCount] = useState<number>(0)
  const [confirmedLocation, setConfirmedLocation] = useState<ConfirmedLocation | null>(null)
  const [selectedListing, setSelectedListing] = useState<ListingWithMetadata | null>(null)
  const [catalogName, setCatalogName] = useState('')
  const [isEditingCatalogName, setIsEditingCatalogName] = useState(false)
  const [tempCatalogName, setTempCatalogName] = useState('')
  const [currentCatalogId, setCurrentCatalogId] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [catalogMembers, setCatalogMembers] = useState<Array<{ user_id: string; email: string | null; role: string }>>([])
  const [isOwner, setIsOwner] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<{ user_id: string; email: string | null } | null>(null)
  const [showProfilePopover, setShowProfilePopover] = useState(false)
  const [showHelpPopover, setShowHelpPopover] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeModalTrigger, setUpgradeModalTrigger] = useState<'invite' | 'listings' | 'general'>('general')
  const [showDreamApartmentModal, setShowDreamApartmentModal] = useState(false)
  const [dreamApartmentDescription, setDreamApartmentDescription] = useState<string | null>(null)
  const [listingComparisons, setListingComparisons] = useState<Map<string, { score: number; summary: string }>>(new Map())
  const [isEvaluatingListings, setIsEvaluatingListings] = useState(false)
  const [evaluatingListingId, setEvaluatingListingId] = useState<string | null>(null)
  const catalogInputRef = useRef<HTMLInputElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const searchTextareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const listingsRef = useRef<ListingWithMetadata[]>([])
  const catalogIdsRef = useRef<string[]>([])
  const masonryContainerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [masonryPositions, setMasonryPositions] = useState<Map<string, { top: number; left: number; width: number }>>(new Map())
  const [containerHeight, setContainerHeight] = useState<number>(0)

  // Calculate masonry layout positions
  useEffect(() => {
    if (!masonryContainerRef.current || listings.length === 0) {
      setMasonryPositions(new Map())
      setContainerHeight(0)
      return
    }

    const calculateMasonry = () => {
      const container = masonryContainerRef.current
      if (!container) return

      const containerWidth = container.offsetWidth
      // Match Tailwind gap values: gap-6 = 24px (1.5rem), gap-8 = 32px (2rem)
      const gap = window.innerWidth >= 1024 ? 32 : window.innerWidth >= 768 ? 24 : 24
      const columns = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1
      const columnWidth = (containerWidth - (gap * (columns - 1))) / columns

      const columnHeights = new Array(columns).fill(0)
      const positions = new Map<string, { top: number; left: number; width: number }>()

      // Process listings in order (left-to-right, top-to-bottom)
      listings.forEach((listing) => {
        const cardElement = cardRefs.current.get(listing.id)
        if (!cardElement) {
          // Card not yet rendered, skip for now
          return
        }

        // Find the shortest column
        const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights))
        
        // Calculate position
        const left = shortestColumnIndex * (columnWidth + gap)
        const top = columnHeights[shortestColumnIndex]

        positions.set(listing.id, {
          top,
          left,
          width: columnWidth
        })

        // Update column height (include margin bottom: mb-4 = 16px, sm:mb-6 = 24px)
        const marginBottom = window.innerWidth >= 640 ? 24 : 16
        columnHeights[shortestColumnIndex] += cardElement.offsetHeight + marginBottom
      })

      // Only update if we have positions for all cards
      if (positions.size === listings.length) {
        setMasonryPositions(positions)
        setContainerHeight(Math.max(...columnHeights))
      }
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      // Wait a bit for cards to render
      setTimeout(() => {
        calculateMasonry()
        
        // Also wait for images to load and recalculate
        const images = masonryContainerRef.current?.querySelectorAll('img') || []
        let loadedCount = 0
        const totalImages = images.length

        if (totalImages === 0) {
          calculateMasonry()
        } else {
          images.forEach((img) => {
            if (img.complete) {
              loadedCount++
              if (loadedCount === totalImages) {
                calculateMasonry()
              }
            } else {
              img.onload = () => {
                loadedCount++
                if (loadedCount === totalImages) {
                  calculateMasonry()
                }
              }
              img.onerror = () => {
                loadedCount++
                if (loadedCount === totalImages) {
                  calculateMasonry()
                }
              }
            }
          })
        }
      }, 50)
    })

    // Also calculate on window resize
    const handleResize = () => {
      setTimeout(calculateMasonry, 100)
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [listings])
  
  // Detect location from query (called only during search)
  const detectLocationFromQuery = async (query: string): Promise<ConfirmedLocation | null> => {
    if (!query.trim() || query.trim().length < 8) {
      return null
    }

    // Check for location-related keywords
    const lowerQuery = query.toLowerCase()
    const hasLocationKeywords = [
      'near', 'close to', 'by ', 'next to', 'around',
      'within', 'from ', 'metro', 'm1', 'm2', 'm3', 'm4', 'm5',
      'station', 'university', 'università', 'politecnico', 'bocconi',
      'cattolica', 'bicocca', 'central', 'centrale'
    ].some(keyword => lowerQuery.includes(keyword))

    if (!hasLocationKeywords) {
      return null
    }

    try {
      // Detect location
      const response = await fetch('/api/detect-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        return null
      }

      const result = await response.json()

      if (result.hasLocation && result.detectedLocation && result.displayName) {
        // Geocode the location
        const geocodeResponse = await fetch(
          `/api/geocode?q=${encodeURIComponent(result.detectedLocation)}`
        )

        if (geocodeResponse.ok) {
          const geocodeResult = await geocodeResponse.json()

          if (geocodeResult.latitude && geocodeResult.longitude) {
            return {
              name: result.displayName,
              fullQuery: result.detectedLocation,
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              distance: result.defaultDistance || 1.5
            }
          }
        }
      }
    } catch (error) {
      console.warn('Location detection error:', error)
    }

    return null
  }

  // Remove confirmed location
  const removeConfirmedLocation = () => {
    setConfirmedLocation(null)
  }

  // Fetch listings function (using useCallback so it can be called from button)
  const fetchListings = useCallback(async () => {
    const supabase = createClient()
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        setLoading(false)
        return
      }

      // Get user's catalog IDs
      const { data: catalogMemberships, error: membershipError } = await supabase
        .from('catalog_members')
        .select('catalog_id')
        .eq('user_id', currentUser.id)

      let catalogIds: string[] = []

      if (membershipError) {
        // Log full error details for debugging
        console.error('Error fetching catalog memberships:', {
          message: membershipError.message,
          code: membershipError.code,
          details: membershipError.details,
          hint: membershipError.hint,
          fullError: membershipError
        })
        
        // Check if error is because table doesn't exist (migration not run)
        if (membershipError.message?.includes('does not exist') || membershipError.code === '42P01') {
          console.warn('Catalog tables not found. Please run the migration 006_multiplayer_catalogs.sql')
          // Fallback: try to fetch listings the old way (without catalog filtering)
          // This allows the app to work before migration is run
          const { data: oldListings, error: oldError } = await supabase
            .from('listings')
            .select(`
              *,
              listing_metadata (*)
            `)
            .eq('user_id', currentUser.id)
            .order('saved_at', { ascending: false })
          
          if (oldError) {
            console.error('Error fetching listings:', oldError)
            setLoading(false)
            return
          }
          
          const fetchedListings = (oldListings || []).map((l: any) => ({
            ...l,
            listing_notes: []
          }))
          // Ensure listings are sorted by saved_at (most recent first)
          const sortedOldListings = [...fetchedListings].sort((a, b) => {
            const dateA = new Date(a.saved_at || a.created_at || 0).getTime()
            const dateB = new Date(b.saved_at || b.created_at || 0).getTime()
            return dateB - dateA // Descending: most recent first
          })
          setListings(sortedOldListings)
          setAllListings(sortedOldListings)
          listingsRef.current = sortedOldListings
          setLoading(false)
          return
        }
        
        // For other errors, try to continue by creating a default catalog
        console.warn('Could not fetch catalog memberships, attempting to create default catalog')
      }

      catalogIds = catalogMemberships?.map(cm => cm.catalog_id) || []
      catalogIdsRef.current = catalogIds // Store for subscriptions
      catalogIdsRef.current = catalogIds // Store for subscriptions
      
      // If user has no catalog memberships, try to create/get default catalog
      if (catalogIds.length === 0) {
        console.log('User has no catalog memberships, creating default catalog...')
        
        // Try to get existing catalog (use maybeSingle to avoid error if none exists)
        // First try to get any catalog the user created
        const { data: defaultCatalog, error: catalogQueryError } = await supabase
          .from('catalogs')
          .select('id')
          .eq('created_by', currentUser.id)
          .limit(1)
          .maybeSingle()
        
        // If that fails, try to get any catalog where user is a member
        let catalogToUse = defaultCatalog
        if (!defaultCatalog && !catalogQueryError) {
          const { data: memberCatalog } = await supabase
            .from('catalog_members')
            .select('catalog_id')
            .eq('user_id', currentUser.id)
            .limit(1)
            .maybeSingle()
          
          if (memberCatalog) {
            const { data: catalog } = await supabase
              .from('catalogs')
              .select('id')
              .eq('id', memberCatalog.catalog_id)
              .maybeSingle()
            catalogToUse = catalog || null
          }
        }
        
        if (catalogQueryError) {
          console.error('Error querying for existing catalog:', catalogQueryError)
        }
        
        if (catalogToUse) {
          console.log('Found existing catalog, adding user as member:', catalogToUse.id)
          // Add user as member if not already
          const { error: memberError } = await supabase
            .from('catalog_members')
            .upsert({
              catalog_id: catalogToUse.id,
              user_id: currentUser.id,
            }, {
              onConflict: 'catalog_id,user_id'
            })
          
          if (memberError) {
            console.error('Error adding user to catalog:', memberError)
          } else {
            catalogIds = [catalogToUse.id]
          }
        } else {
          console.log('No existing catalog found, creating new one...')
          // Create default catalog
          const { data: newCatalog, error: catalogError } = await supabase
            .from('catalogs')
            .insert({
              name: 'My Listings',
              created_by: currentUser.id,
            })
            .select()
            .single()
          
          if (catalogError) {
            console.error('Error creating catalog:', catalogError)
          } else if (newCatalog) {
            console.log('Created new catalog, adding user as member:', newCatalog.id)
            // Add user as member
            const { error: memberError } = await supabase
              .from('catalog_members')
              .insert({
                catalog_id: newCatalog.id,
                user_id: currentUser.id,
              })
            
            if (memberError) {
              console.error('Error adding user to new catalog:', memberError)
            } else {
              catalogIds = [newCatalog.id]
            }
          }
        }
      }
      
      if (catalogIds.length === 0) {
        // User has no catalogs and couldn't create one, show empty
        setListings([])
        setAllListings([])
        setLoading(false)
        return
      }

      // Fetch listings from user's catalogs
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          listing_metadata (*),
          listing_notes (*)
        `)
        .in('catalog_id', catalogIds)
        .order('saved_at', { ascending: false })
      
      // Debug: log raw data to see images
      if (data && data.length > 0) {
        console.log('Sample listing data:', {
          id: data[0].id,
          hasImages: !!data[0].images,
          imagesType: typeof data[0].images,
          imagesValue: data[0].images,
          imagesIsArray: Array.isArray(data[0].images)
        })
      }

      if (error) {
        console.error('Error fetching listings:', error)
        return
      }
      const fetchedListings = data || []
      console.log('Fetched listings:', fetchedListings.length)
      
      // Also check metadata directly for listings with status 'done'
      for (const listing of fetchedListings) {
        if (listing.enrichment_status === 'done' && !listing.listing_metadata?.[0]) {
          console.log(`⚠️ Listing ${listing.id} is 'done' but has no metadata. Checking directly...`)
          const { data: directMetadata, error: metaError } = await supabase
            .from('listing_metadata')
            .select('*')
            .eq('listing_id', listing.id)
            .single()
          
          console.log(`Direct metadata query for ${listing.id}:`, {
            found: !!directMetadata,
            error: metaError?.message,
            metadata: directMetadata
          })
          
          // If we found metadata directly, attach it to the listing
          if (directMetadata && !metaError) {
            listing.listing_metadata = [directMetadata]
            console.log(`✅ Attached metadata directly to listing ${listing.id}`)
          }
        }
        
        // Ensure listing_notes is an array
        if (!listing.listing_notes) {
          listing.listing_notes = []
        }
        
        console.log(`Listing ${listing.id}:`, {
          status: listing.enrichment_status,
          hasMetadata: !!listing.listing_metadata?.[0],
          metadataCount: listing.listing_metadata?.length || 0,
          notesCount: listing.listing_notes?.length || 0
        })
      }
      // Ensure listings are sorted by saved_at (most recent first)
      const sortedListings = [...fetchedListings].sort((a, b) => {
        const dateA = new Date(a.saved_at || a.created_at || 0).getTime()
        const dateB = new Date(b.saved_at || b.created_at || 0).getTime()
        return dateB - dateA // Descending: most recent first
      })
      
      setListings(sortedListings)
      setAllListings(sortedListings) // Store all listings
      listingsRef.current = sortedListings

      // Set currentCatalogId if not set and we have catalog IDs
      if (catalogIds.length > 0 && !currentCatalogId) {
        setCurrentCatalogId(catalogIds[0])
      }

      // Fetch catalog members for the current catalog
      const catalogIdToUse = currentCatalogId || catalogIds[0]
      console.log('Fetching catalog members for catalog:', catalogIdToUse)
      
      if (catalogIdToUse) {
        const { data: members, error: membersError } = await supabase
          .from('catalog_members')
          .select('user_id, role')
          .eq('catalog_id', catalogIdToUse)

        console.log('Catalog members query result:', { members, membersError })

        if (!membersError && members && members.length > 0) {
          console.log(`Found ${members.length} catalog members:`, members)
          
          // Check if current user is an owner
          const currentUserMembership = members.find(m => m.user_id === currentUser.id)
          setIsOwner(currentUserMembership?.role === 'owner')
          
          // Get emails for each member using the function
          // If the function doesn't exist or fails, we'll use user_id for display
          const membersWithEmails = await Promise.all(
            members.map(async (member) => {
              let email: string | null = null
              
              // Try to get email from RPC function
              try {
                console.log('Fetching email for user:', member.user_id)
                const { data: emailData, error: emailError } = await supabase
                  .rpc('get_user_email', { user_uuid: member.user_id })
                
                console.log('Email fetch result:', { user_id: member.user_id, emailData, emailError })
                
                if (!emailError && emailData) {
                  // The function returns a single TEXT value
                  email = typeof emailData === 'string' ? emailData : String(emailData)
                } else if (emailError) {
                  console.warn('RPC function error (function may not exist):', emailError.message)
                  // If function doesn't exist, try to get email from catalog_invitations as fallback
                  const { data: invitation } = await supabase
                    .from('catalog_invitations')
                    .select('invited_email')
                    .eq('catalog_id', catalogIdToUse)
                    .eq('status', 'accepted')
                    .limit(1)
                    .maybeSingle()
                  
                  // This won't work perfectly but it's a fallback
                  // Better approach: store email in catalog_members when user joins
                }
              } catch (err) {
                console.error('Error getting email for user:', member.user_id, err)
              }
              
              return {
                user_id: member.user_id,
                email: (email || (member.user_id === currentUser.id ? currentUser.email : null)) ?? null,
                role: member.role
              }
            })
          )

          console.log('Members with emails:', membersWithEmails)

          // Sort: current user first, then others
          const sortedMembers = membersWithEmails.sort((a, b) => {
            if (a.user_id === currentUser.id) return -1
            if (b.user_id === currentUser.id) return 1
            return 0
          })

          console.log('Sorted members (setting state):', sortedMembers)
          setCatalogMembers(sortedMembers)
        } else if (membersError) {
          console.error('Error fetching catalog members:', membersError)
        } else if (!members || members.length === 0) {
          console.log('No catalog members found for catalog:', catalogIdToUse)
          // Set empty array to show fallback
          setCatalogMembers([])
        }
      } else {
        console.log('No catalog ID available to fetch members')
        setCatalogMembers([])
      }
    } catch (error) {
      console.error('Unexpected error fetching listings:', error)
    } finally {
      setLoading(false)
    }
  }, [currentCatalogId])

  // Fetch user subscription status
  const fetchSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription')
      if (response.ok) {
        const data = await response.json()
        setSubscription(data)
      } else {
        // Default to free plan if fetch fails
        setSubscription({
          plan: 'free',
          isPremium: false,
          listingsCount: 0,
          listingsLimit: 12,
          canInvite: false,
          currentPeriodEnd: null,
        })
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
      setSubscription({
        plan: 'free',
        isPremium: false,
        listingsCount: 0,
        listingsLimit: 12,
        canInvite: false,
        currentPeriodEnd: null,
      })
    }
  }, [])

  // Fetch user's dream apartment description
  const fetchDreamApartment = useCallback(async () => {
    try {
      const response = await fetch('/api/user-preferences')
      if (response.ok) {
        const data = await response.json()
        setDreamApartmentDescription(data.dream_apartment_description)
      }
    } catch (error) {
      console.error('Error fetching dream apartment:', error)
    }
  }, [])

  // Fetch listing comparisons for current user
  const fetchListingComparisons = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('listing_comparisons')
        .select('listing_id, match_score, comparison_summary')
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching comparisons:', error)
        return
      }

      const comparisonsMap = new Map<string, { score: number; summary: string }>()
      data?.forEach(comp => {
        comparisonsMap.set(comp.listing_id, {
          score: comp.match_score,
          summary: comp.comparison_summary
        })
      })
      setListingComparisons(comparisonsMap)
    } catch (error) {
      console.error('Error fetching comparisons:', error)
    }
  }, [])

  // Save dream apartment description
  const saveDreamApartment = useCallback(async (description: string) => {
    setIsEvaluatingListings(true)
    try {
      const response = await fetch('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dream_apartment_description: description })
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      setDreamApartmentDescription(description || null)

      // If description is cleared, clear comparisons
      if (!description) {
        setListingComparisons(new Map())
        setIsEvaluatingListings(false)
        return
      }

      // Real-time subscriptions will automatically update the comparisons as they complete
      // Set a timeout to stop the "evaluating" state after a reasonable time
      // The evaluations will continue in the background and update via real-time subscription
      setTimeout(() => {
        setIsEvaluatingListings(false)
      }, 30000) // 30 seconds - enough time for the first batch to complete

    } catch (error) {
      setIsEvaluatingListings(false)
      throw error
    }
  }, [])

  // Load catalog name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('flatlist-catalog-name')
    if (savedName) {
      setCatalogName(savedName)
    } else {
      setCatalogName('My Listings')
    }
  }, [])

  // Focus input when editing catalog name
  useEffect(() => {
    if (isEditingCatalogName && catalogInputRef.current) {
      catalogInputRef.current.focus()
      catalogInputRef.current.select()
    }
  }, [isEditingCatalogName])

  // Auto-resize search textarea - only grow if content exceeds single line
  useEffect(() => {
    const textarea = searchTextareaRef.current
    if (textarea) {
      // Reset height to get accurate scrollHeight
      textarea.style.height = 'auto'
      // Get the natural height for one line
      const singleLineHeight = textarea.scrollHeight
      // Set height to scrollHeight (will be single line height if text fits, or more if it wraps)
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [searchQuery])

  // Close profile popover on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showProfilePopover) {
        setShowProfilePopover(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showProfilePopover])

  useEffect(() => {
    const supabase = createClient()

    // Check auth and sync tokens to extension
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/auth')
        return
      }
      setUser(user)
      
      // Check for upgrade query parameter
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('upgrade') === 'true') {
        // Show upgrade modal and clean up URL
        setUpgradeModalTrigger('general')
        setShowUpgradeModal(true)
        // Remove the query param from URL without reload
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
      
      // Fetch subscription status
      fetchSubscription()
      
      // Fetch dream apartment preferences and comparisons
      fetchDreamApartment()
      fetchListingComparisons()
      
      // Fetch user's catalog (with error handling for missing tables)
      try {
        const { data: catalogMember, error: memberError } = await supabase
          .from('catalog_members')
          .select('catalog_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()
        
        if (!memberError && catalogMember) {
          setCurrentCatalogId(catalogMember.catalog_id)
        } else {
          // If no catalog membership, get or create default catalog
          const { data: defaultCatalog, error: catalogError } = await supabase
            .from('catalogs')
            .select('id')
            .eq('created_by', user.id)
            .limit(1)
            .single()
          
          if (!catalogError && defaultCatalog) {
            setCurrentCatalogId(defaultCatalog.id)
            // Ensure user is a member
            await supabase
              .from('catalog_members')
              .upsert({
                catalog_id: defaultCatalog.id,
                user_id: user.id,
              }, {
                onConflict: 'catalog_id,user_id'
              })
          }
        }
      } catch (err) {
        // Tables might not exist if migration hasn't been run
        console.warn('Could not fetch catalog (migration may not be run):', err)
      }
      
      // Get session and sync tokens to extension automatically
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          syncTokensToExtension(session.access_token, session.refresh_token, session.expires_at)
        }
      })
    })

    // Listen for auth changes and sync tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        syncTokensToExtension(session.access_token, session.refresh_token, session.expires_at)
      }
    })

    fetchListings()

    // Polling fallback: refresh listings every 3 seconds if there are pending/processing listings
    // OR if there are done listings without metadata (in case metadata was just saved)
    const pollInterval = setInterval(() => {
      const hasPending = listingsRef.current.some(l => 
        l.enrichment_status === 'pending' || 
        l.enrichment_status === 'processing'
      )
      const hasDoneWithoutMetadata = listingsRef.current.some(l => 
        l.enrichment_status === 'done' && !l.listing_metadata?.[0]
      )
      if (hasPending || hasDoneWithoutMetadata) {
        console.log('Polling: Refreshing listings', {
          hasPending,
          hasDoneWithoutMetadata,
          count: listingsRef.current.length
        })
        fetchListings()
      }
    }, 3000)

    return () => {
      clearInterval(pollInterval)
      subscription.unsubscribe()
    }
  }, [router, fetchListings])

  // Set up real-time subscriptions when currentCatalogId is available
  useEffect(() => {
    if (!currentCatalogId) return

    const supabase = createClient()
    console.log('Setting up real-time subscriptions for catalog:', currentCatalogId)

    const channel = supabase
      .channel(`catalog-${currentCatalogId}-changes`)
      // Listen for catalog name changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'catalogs',
          filter: `id=eq.${currentCatalogId}`,
        },
        (payload) => {
          console.log('📝 Catalog name changed:', payload.new)
          const newName = (payload.new as any)?.name
          if (newName) {
            console.log('🔄 Updating catalog name to:', newName)
            setCatalogName(newName)
            localStorage.setItem('flatlist-catalog-name', newName)
          }
        }
      )
      // Listen for listing changes (add/update/delete) - filter by catalog_id
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listings',
          filter: `catalog_id=eq.${currentCatalogId}`,
        },
        (payload) => {
          console.log('📋 Listing changed:', {
            eventType: payload.eventType,
            listingId: (payload.new as any)?.id || (payload.old as any)?.id,
            catalogId: (payload.new as any)?.catalog_id || (payload.old as any)?.catalog_id,
            payload: payload
          })
          // Small delay to ensure database is consistent
          setTimeout(() => {
            fetchListings()
          }, 100)
        }
      )
      // Listen for listing metadata changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listing_metadata',
        },
        (payload) => {
          const listingId = (payload.new as any)?.listing_id
          console.log('📊 Listing metadata changed:', {
            eventType: payload.eventType,
            listingId: listingId,
            payload: payload
          })
          // Small delay to ensure database is consistent
          setTimeout(() => {
            fetchListings()
          }, 100)
        }
      )
      // Listen for listing notes changes (add/update/delete)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listing_notes',
        },
        (payload) => {
          const listingId = (payload.new as any)?.listing_id || (payload.old as any)?.listing_id
          console.log('💬 Listing note changed:', {
            eventType: payload.eventType,
            listingId: listingId,
            userId: (payload.new as any)?.user_id || (payload.old as any)?.user_id,
            note: (payload.new as any)?.note || '(deleted)',
            payload: payload
          })
          
          // Update the specific listing's notes without full refresh
          if (listingId) {
            // Fetch updated notes for this listing (all users' notes)
            supabase
              .from('listing_notes')
              .select('*')
              .eq('listing_id', listingId)
              .then(({ data: updatedNotes, error }) => {
                if (!error && updatedNotes) {
                  console.log('✅ Updated notes for listing:', listingId, updatedNotes)
                  setListings(prev => prev.map(listing => 
                    listing.id === listingId 
                      ? { ...listing, listing_notes: updatedNotes }
                      : listing
                  ))
                  setAllListings(prev => prev.map(listing => 
                    listing.id === listingId 
                      ? { ...listing, listing_notes: updatedNotes }
                      : listing
                  ))
                } else {
                  console.error('❌ Error fetching updated notes:', error)
                  // Fallback to full refresh if note fetch fails
                  fetchListings()
                }
              })
          }
        }
      )
      // Listen for catalog members changes (to update profile pictures)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'catalog_members',
          filter: `catalog_id=eq.${currentCatalogId}`,
        },
        async (payload) => {
          console.log('👥 Catalog members changed:', payload.eventType)
          // Refresh catalog members to update profile pictures
          const { data: members, error: membersError } = await supabase
            .from('catalog_members')
            .select('user_id, role')
            .eq('catalog_id', currentCatalogId)

          if (!membersError && members) {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (currentUser) {
              // Update isOwner status
              const currentUserMembership = members.find(m => m.user_id === currentUser.id)
              setIsOwner(currentUserMembership?.role === 'owner')
              
              const membersWithEmails = await Promise.all(
                members.map(async (member) => {
                  try {
                    const { data: emailData, error: emailError } = await supabase
                      .rpc('get_user_email', { user_uuid: member.user_id })
                    
                    const email = emailError ? null : (typeof emailData === 'string' ? emailData : null)
                    return {
                      user_id: member.user_id,
                      email: (email || (member.user_id === currentUser.id ? currentUser.email : null)) ?? null,
                      role: member.role
                    }
                  } catch (err) {
                    return {
                      user_id: member.user_id,
                      email: (member.user_id === currentUser.id ? currentUser.email : null) ?? null,
                      role: member.role
                    }
                  }
                })
              )

              const sortedMembers = membersWithEmails.sort((a, b) => {
                if (a.user_id === currentUser.id) return -1
                if (b.user_id === currentUser.id) return 1
                return 0
              })

              setCatalogMembers(sortedMembers)
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active for catalog:', currentCatalogId)
          console.log('📡 Listening for changes on tables: catalogs, listings, listing_metadata, listing_notes, catalog_members')
        } else if (status === 'CHANNEL_ERROR') {
          // Non-fatal: optimistic updates handle UI changes, subscription is just for cross-user sync
          console.warn('⚠️ Real-time subscription error (non-fatal - optimistic updates will handle UI)')
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Real-time subscription timed out (non-fatal)')
        } else if (status === 'CLOSED') {
          console.warn('🔴 Real-time subscription closed')
        }
      })

    return () => {
      console.log('Cleaning up real-time subscription for catalog:', currentCatalogId)
      supabase.removeChannel(channel)
    }
  }, [currentCatalogId, fetchListings])

  // Real-time subscription for listing comparisons (separate channel for user-specific updates)
  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()
    
    const comparisonsChannel = supabase
      .channel(`user-${user.id}-comparisons`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listing_comparisons',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🏠 Listing comparison updated:', payload.eventType)
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newComparison = payload.new as any
            if (newComparison?.listing_id) {
              setListingComparisons(prev => {
                const updated = new Map(prev)
                updated.set(newComparison.listing_id, {
                  score: newComparison.match_score,
                  summary: newComparison.comparison_summary
                })
                return updated
              })
              setEvaluatingListingId(prev => prev === newComparison.listing_id ? null : prev)
            }
          } else if (payload.eventType === 'DELETE') {
            const oldComparison = payload.old as any
            if (oldComparison?.listing_id) {
              setListingComparisons(prev => {
                const updated = new Map(prev)
                updated.delete(oldComparison.listing_id)
                return updated
              })
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active for comparisons')
        }
      })

    return () => {
      supabase.removeChannel(comparisonsChannel)
    }
  }, [user?.id])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleViewDetails = (listing: ListingWithMetadata) => {
    setSelectedListing(listing)
  }

  // Trigger single-listing evaluation when user opens detail and there's no score yet
  const handleEvaluateListing = useCallback(async () => {
    if (!selectedListing || !dreamApartmentDescription) return
    setEvaluatingListingId(selectedListing.id)
    try {
      const res = await fetch('/api/reevaluate-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: selectedListing.id })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Evaluate listing failed:', data)
        setEvaluatingListingId(null)
      }
      // Success: real-time subscription or timeout will clear evaluatingListingId
      setTimeout(() => setEvaluatingListingId(null), 90000)
    } catch (err) {
      console.error('Evaluate listing error:', err)
      setEvaluatingListingId(null)
    }
  }, [selectedListing, dreamApartmentDescription])

  // When opening a listing that has no comparison yet, auto-trigger evaluation once
  const hasTriggeredEvaluationRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedListing?.id) {
      hasTriggeredEvaluationRef.current = null
      return
    }
    if (!dreamApartmentDescription || evaluatingListingId) return
    if (listingComparisons.has(selectedListing.id)) return
    if (hasTriggeredEvaluationRef.current === selectedListing.id) return
    hasTriggeredEvaluationRef.current = selectedListing.id
    setEvaluatingListingId(selectedListing.id)
    fetch('/api/reevaluate-listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: selectedListing.id })
    })
      .then(res => { if (!res.ok) setEvaluatingListingId(null) })
      .catch(() => setEvaluatingListingId(null))
    setTimeout(() => setEvaluatingListingId(null), 90000)
  }, [selectedListing?.id, dreamApartmentDescription, evaluatingListingId, listingComparisons])

  const handleStartEditingCatalogName = () => {
    setTempCatalogName(catalogName)
    setIsEditingCatalogName(true)
  }

  const handleSaveCatalogName = async () => {
    const newName = tempCatalogName.trim() || 'My Listings'
    setCatalogName(newName)
    localStorage.setItem('flatlist-catalog-name', newName)
    setIsEditingCatalogName(false)

    // Save to database if we have a catalog ID
    if (currentCatalogId) {
      const supabase = createClient()
      const { error } = await supabase
        .from('catalogs')
        .update({ name: newName })
        .eq('id', currentCatalogId)

      if (error) {
        console.error('Error updating catalog name:', error)
        // Revert on error
        setCatalogName(catalogName)
        alert('Failed to update catalog name. Please try again.')
      }
    }
  }

  const handleCancelEditingCatalogName = () => {
    setIsEditingCatalogName(false)
  }

  const handleCatalogNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveCatalogName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEditingCatalogName()
    }
  }

  const handleSaveNote = async (listingId: string, note: string) => {
    const supabase = createClient()
    
    // Get current user
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return
    }

    // Optimistically update the UI immediately
    const updateListingNote = (prev: ListingWithMetadata[]) => {
      return prev.map(listing => {
        if (listing.id !== listingId) return listing
        
        // Update or create the shared note (single note per listing)
        const existingNote = listing.listing_notes?.[0]
        const updatedNote = {
          id: existingNote?.id || 'temp-' + Date.now(),
          listing_id: listingId,
          user_id: currentUser.id,
          note: note,
          created_at: existingNote?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        return { ...listing, listing_notes: [updatedNote] }
      })
    }

    // Optimistically update both listings states
    setListings(updateListingNote)
    setAllListings(updateListingNote)

    // Use upsert to update existing note or create new one
    const { error } = await supabase
      .from('listing_notes')
      .upsert({
        listing_id: listingId,
        user_id: currentUser.id,
        note: note.trim() || '',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      })

    if (error) {
      console.error('Error saving note:', error)
      // Rollback optimistic update on error
      fetchListings()
      return
    }

    // Note: Real-time subscription will confirm the change and sync to all users
  }

  const handleDelete = async (listingId: string) => {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId)

    if (error) {
      console.error('Error deleting listing:', error)
      alert('Failed to delete listing. Please try again.')
      return
    }

    // Remove from local state immediately for better UX
    setListings(listings.filter(l => l.id !== listingId))
    setAllListings(allListings.filter(l => l.id !== listingId))
  }

  const handleRemoveMemberClick = (memberUserId: string) => {
    if (!currentCatalogId || !isOwner) return
    const member = catalogMembers.find(m => m.user_id === memberUserId)
    if (member) {
      setMemberToRemove({ user_id: member.user_id, email: member.email })
    }
  }

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !currentCatalogId) return
    
    setRemovingMember(memberToRemove.user_id)
    
    try {
      const response = await fetch('/api/remove-collaborator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          catalogId: currentCatalogId,
          userId: memberToRemove.user_id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        alert(result.error || 'Failed to remove collaborator')
        return
      }

      // Remove from local state immediately for better UX
      setCatalogMembers(catalogMembers.filter(m => m.user_id !== memberToRemove.user_id))
    } catch (error: any) {
      console.error('Error removing member:', error)
      alert('Failed to remove collaborator. Please try again.')
    } finally {
      setRemovingMember(null)
      setMemberToRemove(null)
    }
  }

  const handleRetryEnrichment = async (listingId: string) => {
    try {
      // Reset status to pending first
      const supabase = createClient()
      await supabase
        .from('listings')
        .update({ enrichment_status: 'pending' })
        .eq('id', listingId)

      // Trigger enrichment
      const response = await fetch('/api/trigger-enrichment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listing_id: listingId }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.error?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
          alert('Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set in .env.local. See README for setup instructions.')
        } else {
          alert(`Failed to trigger enrichment: ${result.error || 'Unknown error'}`)
        }
        return
      }

      // Refresh listings after a short delay
      setTimeout(() => {
        fetchListings()
      }, 2000)
    } catch (error: any) {
      console.error('Error triggering enrichment:', error)
      alert(`Error: ${error.message}`)
    }
  }

  const performSearch = async () => {
    if (!searchQuery.trim() && !confirmedLocation) {
      // Clear search - show all listings, sorted by saved_at (most recent first)
      const sortedAllListings = [...allListings].sort((a, b) => {
        const dateA = new Date(a.saved_at || a.created_at || 0).getTime()
        const dateB = new Date(b.saved_at || b.created_at || 0).getTime()
        return dateB - dateA // Descending: most recent first
      })
      setListings(sortedAllListings)
      setSearchExplanation('')
      setSearchFilters({})
      setSearchResultCount(0)
      setConfirmedLocation(null)
      return
    }

    setSearchLoading(true)
    setSearchExplanation('')

    try {
      // Detect location from query (only if we don't already have one)
      let locationToUse = confirmedLocation
      if (!locationToUse && searchQuery.trim()) {
        locationToUse = await detectLocationFromQuery(searchQuery)
        if (locationToUse) {
          setConfirmedLocation(locationToUse)
        }
      }

      let filters: SearchFilters = {}

      // Parse query using AI (only for non-location filters if we have confirmed location)
      if (searchQuery.trim()) {
        const response = await fetch('/api/parse-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery }),
        })

        if (response.ok) {
          const data = await response.json()
          filters = data.filters || {}
        }
      }

      // If we have a detected/confirmed location, use it instead of any LLM-extracted location
      if (locationToUse) {
        // Remove any LLM-extracted location (we have a confirmed one)
        delete filters.distance_reference
        delete filters.distance_max
        
        // Add the confirmed location as the filter
        filters.distance_reference = locationToUse.fullQuery
        filters.distance_max = locationToUse.distance
      }

      // Use the extracted function with pre-confirmed coordinates
      await performSearchWithFilters(filters, locationToUse)
    } catch (error: any) {
      console.error('Search error:', error)
      setSearchExplanation(`Error performing search: ${error?.message || 'Unknown error'}`)
      setSearchLoading(false)
    }
  }

  const performSearchWithFilters = async (filtersToUse: SearchFilters, preConfirmedLocation?: ConfirmedLocation | null) => {
    setSearchLoading(true)
    setSearchExplanation('')

    try {
      const supabase = createClient()

      // Get all enriched listings
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
        setSearchExplanation('No enriched listings found. Save and wait for AI enrichment to complete.')
        setSearchLoading(false)
        return
      }

      // Query metadata with filters
      let metadataQuery = supabase
        .from('listing_metadata')
        .select(`
          *,
          listings!inner (*)
        `)
        .in('listing_id', enrichedListingIds)

      // Apply filters
      if (filtersToUse.noise_level) {
        metadataQuery = metadataQuery.eq('noise_level', filtersToUse.noise_level)
      }
      if (filtersToUse.student_friendly !== undefined) {
        metadataQuery = metadataQuery.eq('student_friendly', filtersToUse.student_friendly)
      }
      if (filtersToUse.natural_light) {
        metadataQuery = metadataQuery.eq('natural_light', filtersToUse.natural_light)
      }
      if (filtersToUse.floor_type) {
        metadataQuery = metadataQuery.eq('floor_type', filtersToUse.floor_type)
      }
      if (filtersToUse.renovation_state) {
        metadataQuery = metadataQuery.eq('renovation_state', filtersToUse.renovation_state)
      }
      if (filtersToUse.price_max) {
        metadataQuery = metadataQuery.lte('price', filtersToUse.price_max)
      }
      if (filtersToUse.price_min) {
        metadataQuery = metadataQuery.gte('price', filtersToUse.price_min)
      }
      if (filtersToUse.size_sqm_min) {
        metadataQuery = metadataQuery.gte('size_sqm', filtersToUse.size_sqm_min)
      }
      if (filtersToUse.rooms_min) {
        metadataQuery = metadataQuery.gte('rooms', filtersToUse.rooms_min)
      }
      if (filtersToUse.bedrooms_min) {
        metadataQuery = metadataQuery.gte('bedrooms', filtersToUse.bedrooms_min)
      }
      if (filtersToUse.bathrooms_min) {
        metadataQuery = metadataQuery.gte('bathrooms', filtersToUse.bathrooms_min)
      }

      const { data: metadataData, error } = await metadataQuery

      if (error) {
        throw error
      }

      // Transform data
      let listingsData = (metadataData || []).map((item: any) => ({
        ...item.listings,
        listing_metadata: [item]
      }))

      // Apply location keywords filter in JavaScript (to avoid OR query complexity issues)
      if (filtersToUse.location_keywords && filtersToUse.location_keywords.length > 0) {
        listingsData = listingsData.filter((item: ListingWithMetadata) => {
          const address = item.listing_metadata?.[0]?.address?.toLowerCase() || ''
          return filtersToUse.location_keywords!.some(keyword => 
            address.includes(keyword.toLowerCase())
          )
        })
      }

      // Apply distance filtering
      if (filtersToUse.distance_max && filtersToUse.distance_reference) {
        // Use pre-confirmed location coordinates if available (no need to geocode again)
        const referencePoint = preConfirmedLocation ? {
          name: preConfirmedLocation.name,
          latitude: preConfirmedLocation.latitude,
          longitude: preConfirmedLocation.longitude
        } : null

        if (referencePoint) {
          console.log(`📍 Using pre-confirmed location:`, referencePoint)
          const filteredWithDistance = filterByDistance(
            listingsData,
            referencePoint,
            filtersToUse.distance_max
          )
          // Attach distance to each listing for display
          listingsData = filteredWithDistance.map(item => ({
            ...item.listing,
            distanceFromReference: item.distance
          }))
        } else {
          // Fallback to geocoding if no pre-confirmed location
          const { findReferencePoint } = await import('@/lib/geocoding')
          const geocodedPoint = await findReferencePoint(filtersToUse.distance_reference)
          if (geocodedPoint) {
            console.log(`📍 Geocoded "${filtersToUse.distance_reference}" to:`, geocodedPoint)
            const filteredWithDistance = filterByDistance(
              listingsData,
              geocodedPoint,
              filtersToUse.distance_max
            )
            // Attach distance to each listing for display
            listingsData = filteredWithDistance.map(item => ({
              ...item.listing,
              distanceFromReference: item.distance
            }))
          } else {
            console.warn(`⚠️ Could not geocode reference: "${filtersToUse.distance_reference}"`)
          }
        }
      }

      // Sort by recency
      listingsData.sort((a: any, b: any) => {
        return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
      })

      // Rank by match count
      const rankedListings = listingsData.map((listing: ListingWithMetadata) => {
        const metadata = listing.listing_metadata?.[0]
        let matchCount = 0

        if (filtersToUse.noise_level && metadata?.noise_level === filtersToUse.noise_level) matchCount++
        if (filtersToUse.student_friendly !== undefined && metadata?.student_friendly === filtersToUse.student_friendly) matchCount++
        if (filtersToUse.natural_light && metadata?.natural_light === filtersToUse.natural_light) matchCount++
        if (filtersToUse.floor_type && metadata?.floor_type === filtersToUse.floor_type) matchCount++
        if (filtersToUse.renovation_state && metadata?.renovation_state === filtersToUse.renovation_state) matchCount++
        if (filtersToUse.price_max && metadata?.price && metadata.price <= filtersToUse.price_max) matchCount++
        if (filtersToUse.price_min && metadata?.price && metadata.price >= filtersToUse.price_min) matchCount++
        if (filtersToUse.size_sqm_min && metadata?.size_sqm && metadata.size_sqm >= filtersToUse.size_sqm_min) matchCount++
        if (filtersToUse.rooms_min && metadata?.rooms && metadata.rooms >= filtersToUse.rooms_min) matchCount++
        if (filtersToUse.bedrooms_min && metadata?.bedrooms && metadata.bedrooms >= filtersToUse.bedrooms_min) matchCount++
        if (filtersToUse.bathrooms_min && metadata?.bathrooms && metadata.bathrooms >= filtersToUse.bathrooms_min) matchCount++

        return { ...listing, matchCount }
      })

      // Sort by match count, then recency
      rankedListings.sort((a: any, b: any) => {
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount
        }
        return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
      })

      setListings(rankedListings)
      setSearchFilters(filtersToUse)
      setSearchResultCount(rankedListings.length)
      setSearchExplanation(generateExplanation(filtersToUse, rankedListings.length))

    } catch (error: any) {
      console.error('Search error:', error)
      setSearchExplanation(`Error performing search: ${error?.message || 'Unknown error'}`)
    } finally {
      setSearchLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex">
      {/* Left Sidebar */}
      <aside className="fixed left-4 top-4 bottom-4 w-16 rounded-[30px] backdrop-blur-md bg-black/60 border border-white/20 flex flex-col z-30" style={{ backdropFilter: 'blur(12px)' }}>
        {/* Top Section: Logo */}
        <div className="flex flex-col items-center pt-6">
          {/* Logo */}
          <button
            onClick={() => {
              setSearchQuery('')
              setConfirmedLocation(null)
              // Ensure listings are sorted by saved_at (most recent first)
              const sortedAllListings = [...allListings].sort((a, b) => {
                const dateA = new Date(a.saved_at || a.created_at || 0).getTime()
                const dateB = new Date(b.saved_at || b.created_at || 0).getTime()
                return dateB - dateA // Descending: most recent first
              })
              setListings(sortedAllListings)
              setSearchExplanation('')
              setSearchFilters({})
              setSearchResultCount(0)
            }}
            className="cursor-pointer"
            title="Clear search"
          >
            <img src="/flatlist outline logo.svg" alt="flatlist" className="h-8" />
          </button>
        </div>

        {/* Middle Section: Dream Home Button - Vertically Centered */}
        <div className="flex-1 flex items-center justify-center">
          {/* Dream Home Button */}
          <button
            onClick={() => setShowDreamApartmentModal(true)}
            className="text-white hover:opacity-70 transition-opacity"
            title="My Dream Apartment"
          >
            <House className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>

        {/* Bottom Section: Plus and Profile */}
        <div className="flex flex-col items-center gap-6 pb-6">
          {/* Plus (Add) Button */}
          <button
            onClick={() => {
              if (subscription?.canInvite) {
                setShowInviteModal(true)
              } else {
                setUpgradeModalTrigger('invite')
                setShowUpgradeModal(true)
              }
            }}
            className="text-white hover:opacity-70 transition-opacity"
            title={subscription?.canInvite ? 'Add collaborator' : 'Upgrade to invite'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          {/* Profile Button */}
          <div className="relative">
            <button
              ref={profileButtonRef}
              onClick={() => setShowProfilePopover(!showProfilePopover)}
              className="h-[40px] w-[40px] rounded-full flex items-center justify-center text-white text-base font-semibold cursor-pointer hover:opacity-90 transition-opacity"
              style={{ backgroundColor: user?.id ? getUserColor(user.id) : '#9CA3AF' }}
              title={user?.email || 'Profile'}
            >
              {user?.email?.charAt(0).toUpperCase() || '?'}
            </button>
            
            {/* Profile Popover */}
            {showProfilePopover && (
              <>
                {/* Backdrop to close on outside click */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfilePopover(false)}
                />
                {/* Popover */}
                <div className="absolute left-full ml-2 top-0 z-50 bg-white rounded-xl shadow-lg border border-gray-200 min-w-[260px]">
                  <div className="p-4 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">{user?.email}</div>
                    {/* Subscription Status */}
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          subscription?.isPremium 
                            ? 'bg-black text-white' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {subscription?.isPremium ? 'Premium' : 'Free Plan'}
                        </span>
                        {subscription?.isPremium && subscription.currentPeriodEnd && (
                          <div className="text-xs text-gray-500 mt-1">
                            Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                          </div>
                        )}
                        {!subscription?.isPremium && (
                          <div className="text-xs text-gray-500 mt-1">
                            {subscription?.listingsCount || 0} / {subscription?.listingsLimit || 12} listings
                          </div>
                        )}
                      </div>
                      {!subscription?.isPremium && (
                        <button
                          onClick={() => {
                            setShowProfilePopover(false)
                            setUpgradeModalTrigger('general')
                            setShowUpgradeModal(true)
                          }}
                          className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                        >
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-2 border-b border-gray-100">
                    {/* Questions/Help Button - moved inside profile panel */}
                    <button
                      onClick={() => {
                        setShowHelpPopover(!showHelpPopover)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" strokeWidth={2} />
                      Help & Feedback
                    </button>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowProfilePopover(false)
                        handleSignOut()
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Help Popover - shown when clicked from profile panel */}
      {showHelpPopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowHelpPopover(false)}
          />
          <div className="fixed left-[80px] top-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-64">
            <p className="text-sm text-black">
              Have questions, suggestions, or want to report a bug?
            </p>
            <p className="text-sm mt-2 text-black">
              Write to us at{' '}
              <button
                onClick={async (e) => {
                  e.preventDefault()
                  try {
                    await navigator.clipboard.writeText('team@flatlist.app')
                    setEmailCopied(true)
                    setTimeout(() => {
                      setEmailCopied(false)
                      setShowHelpPopover(false)
                    }, 1500)
                  } catch (err) {
                    console.error('Failed to copy:', err)
                  }
                }}
                className="text-black font-medium hover:underline cursor-pointer"
              >
                {emailCopied ? 'Copied!' : 'team@flatlist.app'}
              </button>
            </p>
          </div>
        </>
      )}

      <main className={`flex-1 ml-16 px-6 sm:px-8 pt-8 pb-8 ${allListings.length === 0 ? 'flex items-center justify-center min-h-[calc(100vh-200px)]' : ''}`}>
        {allListings.length === 0 ? (
          <div className="bg-gray-900 rounded-[30px] shadow-sm p-8 text-center border border-gray-800">
            <h2 className="text-xl font-semibold mb-2 text-white">Let's start your hunt.</h2>
            <p className="text-gray-300 mb-8">
              Your collection is looking a little empty.<br />
              Install our extension to save listings from any website in one click.
            </p>
            <a
              href="https://chromewebstore.google.com/detail/flatlist/jfgepfpkigigbkfobopoiidcjjofpbkj"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-black px-6 py-3 rounded-[30px] hover:bg-gray-200 transition-colors font-medium"
            >
              Install the Chrome Extension
            </a>
          </div>
        ) : (
          <>
            {/* Listings Header - only when searching */}
            {(searchQuery || confirmedLocation) && (
              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-white">
                    Search Results ({listings.length})
                  </h2>
                </div>
              </div>
            )}

            {/* Filter Pills - under Search Results */}
            {(searchExplanation || Object.keys(searchFilters).length > 0) && (
              <div className="mb-6">
                <div className="flex flex-wrap items-center gap-2">
                  {searchFilters.noise_level && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      noise level: {searchFilters.noise_level}
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.noise_level
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.student_friendly === true && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      student-friendly
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.student_friendly
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.natural_light && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      natural light: {searchFilters.natural_light}
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.natural_light
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.floor_type && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      {searchFilters.floor_type} floors
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.floor_type
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.price_max && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      under {searchFilters.price_max.toLocaleString('it-IT')}
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.price_max
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.price_min && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      over {searchFilters.price_min.toLocaleString('it-IT')}
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.price_min
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.bedrooms_min && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      {searchFilters.bedrooms_min}+ bedrooms
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.bedrooms_min
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.bathrooms_min && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      {searchFilters.bathrooms_min}+ bathrooms
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.bathrooms_min
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.location_keywords && searchFilters.location_keywords.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      near {searchFilters.location_keywords.join(', ')}
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.location_keywords
                          setSearchFilters(newFilters)
                          performSearchWithFilters(newFilters, confirmedLocation)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {searchFilters.distance_max && searchFilters.distance_reference && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-normal">
                      within {searchFilters.distance_max}km from {searchFilters.distance_reference}
                      <button
                        onClick={() => {
                          const newFilters = { ...searchFilters }
                          delete newFilters.distance_max
                          delete newFilters.distance_reference
                          setSearchFilters(newFilters)
                          setConfirmedLocation(null)
                          performSearchWithFilters(newFilters, null)
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Listings View */}
            {searchLoading ? (
              <div className="text-center py-12">
                <div className="text-lg">Searching...</div>
              </div>
            ) : listings.length === 0 && searchQuery ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No listings match your search</p>
              </div>
            ) : (
              <div 
                ref={masonryContainerRef}
                className="relative pb-4"
                style={{ height: containerHeight > 0 ? `${containerHeight}px` : 'auto' }}
              >
                {listings.map((listing) => {
                  const position = masonryPositions.get(listing.id)
                  return (
                    <div
                      key={listing.id}
                      ref={(el) => {
                        if (el) {
                          cardRefs.current.set(listing.id, el)
                        } else {
                          cardRefs.current.delete(listing.id)
                        }
                      }}
                      className="mb-4 sm:mb-6"
                      style={{
                        position: position ? 'absolute' : 'relative',
                        top: position ? `${position.top}px` : 'auto',
                        left: position ? `${position.left}px` : 'auto',
                        width: position ? `${position.width}px` : '100%',
                        opacity: position ? 1 : 0,
                        transition: 'opacity 0.2s ease-in-out'
                      }}
                    >
                      <ListingCard
                        listing={listing}
                        onViewDetails={() => handleViewDetails(listing)}
                        onSaveNote={handleSaveNote}
                        onDelete={handleDelete}
                        onRetryEnrichment={handleRetryEnrichment}
                        catalogMembers={catalogMembers}
                        matchScore={listingComparisons.get(listing.id)?.score}
                        hasDreamApartment={!!dreamApartmentDescription}
                      />
                    </div>
                  )
                })}
        </div>
            )}
          </>
        )}
      </main>

      {/* Metadata Viewer Modal */}
      <MetadataViewer
        listing={selectedListing}
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        matchScore={selectedListing ? listingComparisons.get(selectedListing.id)?.score : undefined}
        comparisonSummary={selectedListing ? listingComparisons.get(selectedListing.id)?.summary : undefined}
        hasDreamApartment={!!dreamApartmentDescription}
        onOpenDreamApartment={() => setShowDreamApartmentModal(true)}
        onEvaluateListing={handleEvaluateListing}
        isEvaluatingListing={!!selectedListing && evaluatingListingId === selectedListing.id}
        onDelete={handleDelete}
      />

      {/* Invite Collaborator Modal */}
      {currentCatalogId && (
        <InviteCollaboratorModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          catalogId={currentCatalogId}
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false)
          // Refresh subscription after potential checkout
          fetchSubscription()
        }}
        trigger={upgradeModalTrigger}
      />

      {/* Dream Apartment Modal */}
      <DreamApartmentModal
        isOpen={showDreamApartmentModal}
        onClose={() => setShowDreamApartmentModal(false)}
        initialDescription={dreamApartmentDescription}
        onSave={saveDreamApartment}
        isEvaluating={isEvaluatingListings}
      />

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/50 p-4"
          onClick={() => setMemberToRemove(null)}
        >
          <div
            className="bg-gray-900 rounded-[20px] max-w-sm w-full p-6 shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Remove Collaborator</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to remove{' '}
                <span className="font-medium text-white">
                  {memberToRemove.email || 'this collaborator'}
                </span>
                {' '}from this catalog? They will lose access to all listings.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setMemberToRemove(null)}
                  className="px-4 py-2 text-gray-200 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRemoveMember}
                  disabled={removingMember !== null}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {removingMember ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Removing...
                    </>
                  ) : (
                    'Remove'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
