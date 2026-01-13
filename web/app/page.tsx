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
import { useRouter } from 'next/navigation'
import { getUserColor } from '@/lib/user-colors'

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
  const [catalogMembers, setCatalogMembers] = useState<Array<{ user_id: string; email: string | null }>>([])
  const [showProfilePopover, setShowProfilePopover] = useState(false)
  const catalogInputRef = useRef<HTMLInputElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const listingsRef = useRef<ListingWithMetadata[]>([])
  const catalogIdsRef = useRef<string[]>([])
  
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
          setListings(fetchedListings)
          setAllListings(fetchedListings)
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
      setListings(fetchedListings)
      setAllListings(fetchedListings) // Store all listings
      listingsRef.current = fetchedListings

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
          .select('user_id')
          .eq('catalog_id', catalogIdToUse)

        console.log('Catalog members query result:', { members, membersError })

        if (!membersError && members && members.length > 0) {
          console.log(`Found ${members.length} catalog members:`, members)
          
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
                email: (email || (member.user_id === currentUser.id ? currentUser.email : null)) ?? null
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
            .select('user_id')
            .eq('catalog_id', currentCatalogId)

          if (!membersError && members) {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (currentUser) {
              const membersWithEmails = await Promise.all(
                members.map(async (member) => {
                  try {
                    const { data: emailData, error: emailError } = await supabase
                      .rpc('get_user_email', { user_uuid: member.user_id })
                    
                    const email = emailError ? null : (typeof emailData === 'string' ? emailData : null)
                    return {
                      user_id: member.user_id,
                      email: (email || (member.user_id === currentUser.id ? currentUser.email : null)) ?? null
                    }
                  } catch (err) {
                    return {
                      user_id: member.user_id,
                      email: (member.user_id === currentUser.id ? currentUser.email : null) ?? null
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

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleCardClick = (listing: ListingWithMetadata) => {
    window.open(listing.source_url, '_blank')
  }

  const handleViewDetails = (listing: ListingWithMetadata) => {
    setSelectedListing(listing)
  }

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
      alert('You must be logged in to send messages')
      return
    }

    if (!note.trim()) {
      return // Don't send empty messages
    }

    // Optimistically update the UI immediately
    const updateListingNotes = (prev: ListingWithMetadata[]) => {
      return prev.map(listing => {
        if (listing.id !== listingId) return listing
        
        const currentNotes = listing.listing_notes || []
        
        // Always add a new message (chat-style)
        const newMessage = {
          id: 'temp-' + Date.now(),
          listing_id: listingId,
          user_id: currentUser.id,
          note: note.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        return { ...listing, listing_notes: [...currentNotes, newMessage] }
      })
    }

    // Optimistically update both listings states
    setListings(updateListingNotes)
    setAllListings(updateListingNotes)

    // Then perform the actual database operation - always insert a new message
    const { error } = await supabase
      .from('listing_notes')
      .insert({
        listing_id: listingId,
        user_id: currentUser.id,
        note: note.trim(),
      })

    if (error) {
      console.error('Error saving message:', error)
      alert('Failed to send message. Please try again.')
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
      // Clear search - show all listings
      setListings(allListings)
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <button
              onClick={() => {
                setSearchQuery('')
                setConfirmedLocation(null)
                setListings(allListings)
                setSearchExplanation('')
                setSearchFilters({})
                setSearchResultCount(0)
              }}
              className="flex-shrink-0 cursor-pointer"
              title="Clear search"
            >
              <img src="/logo.svg" alt="flatlist" className="h-10" />
            </button>
            
            {/* Search Bar - Centered */}
            <div className="flex-1 flex justify-center px-4">
              <div className="relative w-full max-w-3xl">
                {/* Search input */}
                <div className="flex items-center w-full border border-gray-300 rounded-[30px] bg-white transition-all pl-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') performSearch()
                    }}
                    placeholder="e.g. Sunny 2 bedroom apartments near Susa metro station in Milan"
                    className={`flex-1 py-4 ${searchQuery ? 'pr-28' : 'pr-14'} bg-transparent focus:outline-none text-black`}
                  />
                  
                  {/* Clear button */}
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setConfirmedLocation(null)
                        setListings(allListings)
                        setSearchExplanation('')
                        setSearchFilters({})
                        setSearchResultCount(0)
                      }}
                      className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-[20px] border border-gray-300 hover:bg-gray-50 text-sm bg-white"
                      title="Clear all"
                    >
                      Clear
                    </button>
                  )}
                  
                  {/* Search button */}
                  <button
                    onClick={performSearch}
                    disabled={searchLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-opacity"
                    title="Search"
                  >
                    {searchLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center flex-shrink-0 ml-auto relative">
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
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[200px]">
                    <div className="p-3 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">{user?.email}</div>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {allListings.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">No listings yet</h2>
            <p className="text-black mb-4">
              Use the flatlist browser extension to save apartment listings
            </p>
          </div>
        ) : (
          <>
            {/* Listings Header */}
            <div className="mb-4">
              {searchQuery || confirmedLocation ? (
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">
                    Search Results ({listings.length})
                  </h2>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isEditingCatalogName ? (
                        <input
                          ref={catalogInputRef}
                          type="text"
                          value={tempCatalogName}
                          onChange={(e) => setTempCatalogName(e.target.value)}
                          onKeyDown={handleCatalogNameKeyDown}
                          onBlur={handleSaveCatalogName}
                          className="text-xl font-semibold bg-transparent border-b-2 border-[#FF5C5C] outline-none px-0 py-0"
                          style={{ width: `${Math.max(tempCatalogName.length, 8)}ch` }}
                        />
                      ) : (
                        <h2 
                          className="text-xl font-semibold cursor-pointer hover:text-gray-600 transition-colors"
                          onClick={handleStartEditingCatalogName}
                          title="Click to rename"
                        >
                          {catalogName}
                        </h2>
                      )}
                      <span className="text-xl font-semibold text-gray-500">({allListings.length})</span>
                    </div>
                    {/* Profile icons, add button, and refresh button - all in one row */}
                    <div className="flex items-center justify-between gap-2 mt-2 w-full">
                      <div className="flex items-center gap-2">
                        {/* Display all catalog members' profile pictures */}
                        {catalogMembers.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {catalogMembers.map((member) => (
                              <div key={member.user_id} className="relative group">
                                <div 
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold cursor-default"
                                  style={{ backgroundColor: getUserColor(member.user_id) }}
                                >
                                  {member.email?.charAt(0).toUpperCase() || '?'}
                                </div>
                                {/* Custom tooltip */}
                                {member.email && (
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-white text-black text-xs rounded-lg shadow-lg border border-gray-200 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                                    {member.email}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Fallback: show current user's profile picture if no members loaded yet
                          user && (
                            <div className="relative group">
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold cursor-default"
                                style={{ backgroundColor: user?.id ? getUserColor(user.id) : '#9CA3AF' }}
                              >
                                {user?.email?.charAt(0).toUpperCase() || '?'}
                              </div>
                              {/* Custom tooltip */}
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-white text-black text-xs rounded-lg shadow-lg border border-gray-200 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                                {user?.email}
                              </div>
                            </div>
                          )
                        )}
                        <div className="relative group">
                          <button
                            onClick={() => setShowInviteModal(true)}
                            className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                          {/* Custom tooltip */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-white text-black text-xs rounded-lg shadow-lg border border-gray-200 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                            Add collaborator
                          </div>
                        </div>
                      </div>
                      {/* Refresh button - circular, same size as profile icons, right aligned */}
                      <button
                        onClick={() => {
                          console.log('Manual refresh triggered')
                          fetchListings()
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors flex-shrink-0"
                        title="Refresh"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                <p className="text-gray-600">No listings match your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 pb-4">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onClick={() => handleCardClick(listing)}
                    onViewDetails={() => handleViewDetails(listing)}
                    onSaveNote={handleSaveNote}
                    onDelete={handleDelete}
                    onRetryEnrichment={handleRetryEnrichment}
                    catalogMembers={catalogMembers}
                  />
                ))}
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
      />

      {/* Invite Collaborator Modal */}
      {currentCatalogId && (
        <InviteCollaboratorModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          catalogId={currentCatalogId}
        />
      )}
    </div>
  )
}
