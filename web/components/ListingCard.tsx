'use client'

import { useState, useRef, useEffect } from 'react'
import { ListingWithMetadata } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { getUserColor } from '@/lib/user-colors'
import { BedDouble, Bath, Building, FileText } from 'lucide-react'

interface ListingCardProps {
  listing: ListingWithMetadata
  onClick?: () => void
  onViewDetails?: () => void
  onSaveNote?: (listingId: string, note: string) => void
  onDelete?: (listingId: string) => void
  onRetryEnrichment?: (listingId: string) => void
  catalogMembers?: Array<{ user_id: string; email: string | null }>
  matchScore?: number
  hasDreamApartment?: boolean
}

// Helper function to get score color based on value
function getScoreColor(score: number): string {
  if (score >= 70) {
    return 'bg-green-500'
  } else if (score >= 40) {
    return 'bg-yellow-400'
  } else {
    return 'bg-red-400'
  }
}

export default function ListingCard({ listing, onClick, onViewDetails, onSaveNote, onDelete, onRetryEnrichment, catalogMembers = [], matchScore, hasDreamApartment = false }: ListingCardProps) {
  const [noteText, setNoteText] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showNotesPopover, setShowNotesPopover] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const notesButtonRef = useRef<HTMLButtonElement>(null)
  const [panelPosition, setPanelPosition] = useState<{ top: number; right: number } | null>(null)
  
  const metadata = listing.listing_metadata?.[0]
  const status = listing.enrichment_status
  const sharedNote = listing.listing_notes?.[0] || null

  // Get current user ID and user object
  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient()
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setCurrentUserId(currentUser?.id || null)
      setUser(currentUser)
    }
    getCurrentUser()
  }, [])

  // Initialize note text from shared note
  useEffect(() => {
    setNoteText(sharedNote?.note || '')
  }, [sharedNote?.note])

  // Calculate panel position when opening
  useEffect(() => {
    if (showNotesPopover && notesButtonRef.current) {
      const buttonRect = notesButtonRef.current.getBoundingClientRect()
      // Position above the button
      const panelHeight = 300 // Estimated panel height
      setPanelPosition({
        top: buttonRect.top - panelHeight - 8,
        right: window.innerWidth - buttonRect.right
      })
    } else {
      setPanelPosition(null)
    }
  }, [showNotesPopover])

  // Focus textarea when popover opens
  useEffect(() => {
    if (showNotesPopover && noteTextareaRef.current) {
      setTimeout(() => {
        noteTextareaRef.current?.focus()
      }, 100)
    }
  }, [showNotesPopover])

  // Auto-save with debounce
  useEffect(() => {
    if (!onSaveNote) return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Don't auto-save on initial load
    if (noteText === (sharedNote?.note || '')) {
      return
    }

    setIsSaving(true)
    
    // Debounce save for 1 second after user stops typing
    saveTimeoutRef.current = setTimeout(async () => {
      if (onSaveNote) {
        await onSaveNote(listing.id, noteText)
        setIsSaving(false)
      }
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [noteText, listing.id, onSaveNote, sharedNote?.note])


  // Extract basic info from raw_content if metadata not available
  const extractPriceFromContent = (content: string): string | null => {
    if (!content) return null
    const priceRegex = /€\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)|(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/i
    const match = content.match(priceRegex)
    if (match) {
      return match[0]
    }
    return null
  }

  const extractBasicInfo = () => {
    if (metadata) return null // Use metadata if available
    
    const price = extractPriceFromContent(listing.raw_content)
    const addressMatch = listing.title?.match(/(?:in|a|via|viale|piazza|piazzale)\s+([^,]+)/i)
    const address = addressMatch ? addressMatch[1].trim() : null
    
    return { price, address }
  }

  const basicInfo = extractBasicInfo()

  const getStatusBadge = () => {
    switch (status) {
      case 'processing':
        return <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Processing...</span>
      case 'failed':
        return <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">Failed</span>
      case 'done':
        return null
      default:
        return <span className="text-xs px-2 py-1 bg-gray-700 text-gray-200 rounded">Pending</span>
    }
  }

  const isRental = () => {
    // First check if listing_type is explicitly set in metadata
    if (metadata?.listing_type === 'rent') return true
    if (metadata?.listing_type === 'sale') return false
    
    // Fallback to keyword detection if listing_type is not set
    const content = (listing.raw_content || '').toLowerCase()
    const title = (listing.title || '').toLowerCase()
    const combined = `${content} ${title}`
    
    // Check for rental indicators
    const rentalKeywords = ['affitto', 'rent', 'rental', 'noleggio', 'locazione', '/mo', '/mese', 'mensile', 'monthly']
    const saleKeywords = ['vendita', 'sale', 'compravendita', 'acquisto', 'buy']
    
    const hasRentalKeyword = rentalKeywords.some(keyword => combined.includes(keyword))
    const hasSaleKeyword = saleKeywords.some(keyword => combined.includes(keyword))
    
    // If explicit sale keyword, it's not a rental
    if (hasSaleKeyword) return false
    
    // Only show /mo if we have explicit rental keywords
    return hasRentalKeyword
  }

  const formatPrice = (price: number | null | string | undefined, isRent: boolean = false, currency: string | null = null) => {
    if (!price) return null
    if (typeof price === 'string') {
      // If already formatted string, check if it has /mo
      if (isRent && !price.includes('/mo')) {
        return `${price}/mo`
      }
      return price
    }
    
    // Determine currency symbol/code
    let currencySymbol = '€'
    let locale = 'it-IT'
    
    if (currency) {
      switch (currency.toUpperCase()) {
        case 'EUR':
          currencySymbol = '€'
          locale = 'it-IT'
          break
        case 'USD':
          currencySymbol = '$'
          locale = 'en-US'
          break
        case 'GBP':
          currencySymbol = '£'
          locale = 'en-GB'
          break
        case 'CHF':
          currencySymbol = 'CHF'
          locale = 'de-CH'
          break
        case 'CAD':
          currencySymbol = 'C$'
          locale = 'en-CA'
          break
        case 'AUD':
          currencySymbol = 'A$'
          locale = 'en-AU'
          break
        default:
          currencySymbol = currency
          locale = 'en-US'
      }
    }
    
    const formatted = `${currencySymbol}${price.toLocaleString(locale)}`
    return isRent ? `${formatted}/mo` : formatted
  }
  
  const formatSize = (sizeSqm: number | null, sizeUnit: string | null = null) => {
    if (!sizeSqm) return null
    
    // If size_unit is sqft, convert back from sqm to sqft for display
    if (sizeUnit === 'sqft') {
      const sqft = sizeSqm / 0.092903 // Convert sqm back to sqft
      return `${Math.round(sqft)} sq ft`
    }
    
    // Default to sqm
    return `${Math.round(sizeSqm)} m²`
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (onDelete) {
      setShowDeleteConfirm(true)
    }
  }

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(listing.id)
      setShowDeleteConfirm(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    setNoteText(e.target.value)
  }



  // Get first image for thumbnail
  // Handle both array format and JSONB format from database
  let imagesArray: string[] | null = null
  if (listing.images) {
    if (Array.isArray(listing.images)) {
      imagesArray = listing.images
    } else if (typeof listing.images === 'string') {
      // If stored as JSON string, parse it
      try {
        imagesArray = JSON.parse(listing.images)
      } catch {
        imagesArray = null
      }
    } else if (typeof listing.images === 'object' && listing.images !== null) {
      // If it's an object, try to convert to array
      imagesArray = Object.values(listing.images) as string[]
    }
  }
  
  const thumbnailImage = imagesArray && imagesArray.length > 0 ? imagesArray[0] : null

  return (
    <>
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/10 p-4"
          onClick={cancelDelete}
        >
          <div
            className="bg-white rounded-[20px] max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">Delete Listing</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this listing? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Editor Popover - Outside card to avoid layout shifts */}
      {onSaveNote && showNotesPopover && panelPosition && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation()
              setShowNotesPopover(false)
            }}
          />
          {/* Popover */}
          <div
            className="fixed z-50 w-96 bg-white shadow-2xl border border-gray-200 flex flex-col"
            style={{ 
              borderRadius: '20px', 
              maxHeight: 'calc(100vh - 8rem)',
              top: `${Math.max(8, panelPosition.top)}px`,
              right: `${panelPosition.right}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - absolute positioned */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowNotesPopover(false)
              }}
              className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Text Editor - starts at top */}
            <div className="flex-1 p-4 pt-4 overflow-hidden">
              <textarea
                ref={noteTextareaRef}
                value={noteText}
                onChange={handleNoteChange}
                placeholder="Add notes about this listing..."
                className="w-full h-full text-sm text-gray-900 placeholder-gray-400 border-0 resize-none focus:outline-none"
                style={{ minHeight: '200px' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </>
      )}

      <div
        onClick={onViewDetails || onClick}
        className="cursor-pointer flex flex-col"
      >
      {/* Image section (on top) */}
      <div className="relative">
        {thumbnailImage ? (
          <div className="w-full bg-gray-100 overflow-hidden rounded-xl">
            <img
              src={thumbnailImage}
              alt={listing.title || 'Listing image'}
              className="w-full h-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-[4/3] bg-gray-100 rounded-xl"></div>
        )}
        
        {/* Match Score Badge */}
        {hasDreamApartment && matchScore !== undefined && (
          <div 
            className="absolute top-2 right-2 px-3 py-1.5 rounded-[30px] flex items-center gap-2 backdrop-blur-md bg-black/40 border border-white/20 shadow-lg"
              title={`Match score: ${matchScore}%`}
              style={{ backdropFilter: 'blur(12px)' }}
            >
              <div className={`w-2 h-2 rounded-full ${getScoreColor(matchScore)}`}></div>
              <span className="text-sm font-semibold text-white">{matchScore}</span>
          </div>
        )}
      </div>

      {/* Info (below image, no card) */}
      <div className="pt-2 flex flex-col">
        {getStatusBadge() && (
          <div className="mb-2">
            {getStatusBadge()}
          </div>
        )}

        {/* Show metadata if available, otherwise show basic extracted info */}
        {(metadata || basicInfo) && (
          <div className="space-y-2">
            {/* Price - from metadata or extracted */}
            {(metadata?.price || basicInfo?.price) && (
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-white">
                  {formatPrice(metadata?.price || basicInfo?.price, isRental(), metadata?.currency || null)}
                  {!metadata && basicInfo?.price && (
                    <span className="text-xs font-normal text-gray-400 ml-2">(extracted)</span>
                  )}
                </div>
                {/* Action buttons aligned with price */}
                <div className="flex gap-2">
                  {onSaveNote && (
                    <button
                      ref={notesButtonRef}
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowNotesPopover(!showNotesPopover)
                      }}
                      className="relative p-1.5 rounded-full transition-colors text-gray-400 hover:text-gray-200"
                      title="Notes"
                      aria-label="Notes"
                    >
                      <FileText className="h-5 w-5 relative" />
                      {sharedNote && sharedNote.note && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-[#2C7FFF] rounded-full"></span>
                      )}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="p-1.5 rounded-full text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete listing"
                      aria-label="Delete listing"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Address - from metadata or extracted */}
            {(metadata?.address || basicInfo?.address) && (
              <div className="text-sm text-gray-200">
                {metadata?.address || basicInfo?.address}
                {!metadata && basicInfo?.address && (
                  <span className="text-xs text-gray-500 ml-1">(from title)</span>
                )}
              </div>
            )}

            {/* Metadata - grey text, spaced */}
            {metadata && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                {metadata.size_sqm && formatSize(metadata.size_sqm, metadata.size_unit) && (
                  <span>{formatSize(metadata.size_sqm, metadata.size_unit)}</span>
                )}
                {metadata.bedrooms !== null && metadata.bedrooms !== undefined && metadata.bedrooms > 0 && (
                  <span className="flex items-center gap-1">
                    <BedDouble className="w-3.5 h-3.5" />
                    {metadata.bedrooms}
                  </span>
                )}
                {metadata.bathrooms !== null && metadata.bathrooms !== undefined && metadata.bathrooms > 0 && (
                  <span className="flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5" />
                    {metadata.bathrooms}
                  </span>
                )}
                {metadata.condo_fees && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" />
                    {formatPrice(metadata.condo_fees, false, metadata.currency)}/mo
                  </span>
                )}
                {listing.distanceFromReference !== undefined && (
                  <span>
                    {listing.distanceFromReference < 1 
                      ? `${Math.round(listing.distanceFromReference * 1000)} m away`
                      : `${listing.distanceFromReference.toFixed(1)} km away`
                    }
                  </span>
                )}
              </div>
            )}

            {/* Show distance even without metadata */}
            {!metadata && listing.distanceFromReference !== undefined && (
              <div className="mt-2 text-xs text-gray-400">
                {listing.distanceFromReference < 1 
                  ? `${Math.round(listing.distanceFromReference * 1000)} m away`
                  : `${listing.distanceFromReference.toFixed(1)} km away`
                }
              </div>
            )}

            {/* Show enrichment status message if pending/processing */}
            {!metadata && status !== 'failed' && (
              <div className="text-xs text-gray-400 mt-2">
                {status === 'processing' 
                  ? 'AI enrichment in progress...'
                  : 'Waiting for AI enrichment...'}
              </div>
            )}

            {/* Show retry button if enrichment failed or done but no metadata */}
            {(status === 'failed' || (status === 'done' && !metadata)) && onRetryEnrichment && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRetryEnrichment(listing.id)
                  }}
                  className="text-xs px-3 py-1 bg-[#FF5C5C] text-white rounded hover:opacity-90 transition-colors"
                >
                  Retry Enrichment
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    </>
  )
}
