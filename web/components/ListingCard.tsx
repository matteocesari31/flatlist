'use client'

import { useState, useRef, useEffect } from 'react'
import { ListingWithMetadata } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { getUserColor } from '@/lib/user-colors'
import { BedDouble, Bath, Building } from 'lucide-react'

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

// Helper function to get score color and glow based on value
function getScoreColor(score: number): { bg: string; glow: string } {
  if (score >= 70) {
    return { bg: 'bg-green-500', glow: '0 0 10px 3px rgba(34, 197, 94, 0.55)' }
  } else if (score >= 40) {
    return { bg: 'bg-yellow-400', glow: '0 0 10px 3px rgba(250, 204, 21, 0.55)' }
  } else {
    return { bg: 'bg-red-400', glow: '0 0 10px 3px rgba(248, 113, 113, 0.55)' }
  }
}

export default function ListingCard({ listing, onClick, onViewDetails, onSaveNote, onDelete, onRetryEnrichment, catalogMembers = [], matchScore, hasDreamApartment = false }: ListingCardProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  
  const metadata = listing.listing_metadata?.[0]
  const status = listing.enrichment_status

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


      <div
        onClick={onViewDetails || onClick}
        className="cursor-pointer flex flex-col"
      >
      {/* Image section (on top) - fixed aspect ratio for uniform grid */}
      <div className="relative aspect-[4/3] w-full bg-gray-100 overflow-hidden rounded-[20px]">
        {thumbnailImage ? (
          <img
            src={thumbnailImage}
            alt={listing.title || 'Listing image'}
            className="w-full h-full object-cover transition-transform duration-300 ease-out hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        {/* Match Score Badge */}
        {hasDreamApartment && matchScore !== undefined && (
          <div 
            className="absolute top-2 right-2 px-3 py-1.5 rounded-[30px] flex items-center gap-2 backdrop-blur-md bg-black/60 border border-white/15 shadow-lg"
            style={{ backdropFilter: 'blur(12px)' }}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${getScoreColor(matchScore).bg}`} style={{ boxShadow: getScoreColor(matchScore).glow }}></div>
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
          <div className="space-y-1">
            {/* Price - from metadata or extracted */}
            {(metadata?.price || basicInfo?.price) && (
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-white">
                  {formatPrice(metadata?.price || basicInfo?.price, isRental(), metadata?.currency || null)}
                  {!metadata && basicInfo?.price && (
                    <span className="text-xs font-normal text-[#555555] ml-2">(extracted)</span>
                  )}
                </div>
              </div>
            )}
            
            {/* Address - from metadata or extracted */}
            {(metadata?.address || basicInfo?.address) && (
              <div className="text-sm text-gray-200">
                {metadata?.address || basicInfo?.address}
                {!metadata && basicInfo?.address && (
                  <span className="text-xs text-[#555555] ml-1">(from title)</span>
                )}
              </div>
            )}

            {/* Metadata - grey text, spaced */}
            {metadata && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#555555]">
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
              <div className="mt-2 text-xs text-[#555555]">
                {listing.distanceFromReference < 1 
                  ? `${Math.round(listing.distanceFromReference * 1000)} m away`
                  : `${listing.distanceFromReference.toFixed(1)} km away`
                }
              </div>
            )}

            {/* Show enrichment status message if pending/processing */}
            {!metadata && status !== 'failed' && (
              <div className="text-xs text-[#555555] mt-2">
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
