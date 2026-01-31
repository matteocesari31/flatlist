'use client'

import { ListingWithMetadata } from '@/lib/types'
import { useEffect, useState, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { BedDouble, Bath, Building, MapPin, GraduationCap, Square, Sun, Volume1, PaintRoller, Fence, PawPrint, Armchair, Ellipsis, House, Sparkles } from 'lucide-react'

interface MetadataViewerProps {
  listing: ListingWithMetadata | null
  isOpen: boolean
  onClose: () => void
  matchScore?: number
  comparisonSummary?: string
  hasDreamApartment?: boolean
  onOpenDreamApartment?: () => void
  onEvaluateListing?: () => void
  isEvaluatingListing?: boolean
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

export default function MetadataViewer({ listing, isOpen, onClose, matchScore, comparisonSummary, hasDreamApartment = false, onOpenDreamApartment, onEvaluateListing, isEvaluatingListing = false }: MetadataViewerProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showCardSelector, setShowCardSelector] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ top: 0, right: 0 })
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const rightColumnRef = useRef<HTMLDivElement>(null)
  const cardSelectorButtonRef = useRef<HTMLButtonElement>(null)
  
  // Load card visibility preferences from localStorage
  const [visibleCards, setVisibleCards] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('metadataCardPreferences')
      if (saved) {
        try {
          return new Set(JSON.parse(saved))
        } catch {
          // Default: 6 cards visible (pet_friendly and balcony deselected)
          return new Set(['student_friendly', 'floor_type', 'natural_light', 'noise_level', 'renovation_state', 'furnishing'])
        }
      }
    }
    // Default: 6 cards visible (pet_friendly and balcony deselected)
    return new Set(['student_friendly', 'floor_type', 'natural_light', 'noise_level', 'renovation_state', 'furnishing'])
  })

  const metadata = listing?.listing_metadata?.[0]
  const images = listing?.images ? (Array.isArray(listing.images) ? listing.images : JSON.parse(listing.images as any)) : []

  // Reset image index when listing changes
  useEffect(() => {
    setCurrentImageIndex(0)
  }, [listing?.id])

  // Sync right column height with image container height
  useEffect(() => {
    if (imageContainerRef.current && rightColumnRef.current) {
      const updateHeight = () => {
        if (imageContainerRef.current && rightColumnRef.current) {
          rightColumnRef.current.style.minHeight = `${imageContainerRef.current.offsetHeight}px`
        }
      }
      updateHeight()
      window.addEventListener('resize', updateHeight)
      return () => window.removeEventListener('resize', updateHeight)
    }
  }, [images, listing?.id])

  const nextImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }
  }

  const prevImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const isRental = () => {
    if (!metadata) return false
    
    // First check if listing_type is explicitly set in metadata
    if (metadata.listing_type === 'rent') return true
    if (metadata.listing_type === 'sale') return false
    
    // Fallback to keyword detection if listing_type is not set
    if (!listing) return false
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

  const formatPrice = (price: number | null, isRent: boolean = false, currency: string | null = null) => {
    if (!price) return 'N/A'
    
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

  const formatBoolean = (value: boolean | null) => {
    if (value === null) return 'N/A'
    return value ? 'Yes' : 'No'
  }

  const formatCardTitle = (attribute: string, value: string | boolean | null): string => {
    if (value === null || value === undefined) return attribute
    
    switch (attribute) {
      case 'student_friendly':
        return value === true ? 'Student friendly' : 'Not student friendly'
      case 'floor_type':
        const floorType = value as string
        return floorType === 'wood' ? 'Wood floor' : 
               floorType === 'tile' ? 'Tile floor' : 
               floorType === 'unknown' ? 'Unknown floor type' : 
               `${floorType.charAt(0).toUpperCase() + floorType.slice(1)} floor`
      case 'natural_light':
        const light = value as string
        return light === 'low' ? 'Low natural light' : 
               light === 'medium' ? 'Medium natural light' : 
               light === 'high' ? 'High natural light' : 
               `${light.charAt(0).toUpperCase() + light.slice(1)} natural light`
      case 'noise_level':
        const noise = value as string
        return noise === 'low' ? 'Low noise level' : 
               noise === 'medium' ? 'Medium noise level' : 
               noise === 'high' ? 'High noise level' : 
               `${noise.charAt(0).toUpperCase() + noise.slice(1)} noise level`
      case 'renovation_state':
        const renovation = value as string
        return renovation === 'new' ? 'New renovation' : 
               renovation === 'ok' ? 'OK renovation' : 
               renovation === 'old' ? 'Old renovation' : 
               `${renovation.charAt(0).toUpperCase() + renovation.slice(1)} renovation`
      case 'furnishing':
        return value as string
      case 'pet_friendly':
        return value === true ? 'Pet friendly' : 'Not pet friendly'
      case 'balcony':
        return value === true ? 'Has balcony' : 'No balcony'
      default:
        return attribute
    }
  }

  const toggleCardVisibility = (cardKey: string) => {
    const newVisible = new Set(visibleCards)
    if (newVisible.has(cardKey)) {
      // Removing a card - always allowed
      newVisible.delete(cardKey)
    } else {
      // Adding a card - only if we have less than 6 cards
      if (newVisible.size < 6) {
        newVisible.add(cardKey)
      } else {
        // Already at max, don't add
        return
      }
    }
    setVisibleCards(newVisible)
    if (typeof window !== 'undefined') {
      localStorage.setItem('metadataCardPreferences', JSON.stringify(Array.from(newVisible)))
    }
  }

  const getWebsiteName = (url: string | null | undefined): string => {
    if (!url) return 'original website'
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      // Remove www. prefix if present
      const cleanHostname = hostname.replace(/^www\./, '')
      
      // Handle multi-part TLDs (e.g., .co.uk, .com.au, .co.za)
      const multiPartTlds = [
        'co.uk', 'com.au', 'co.za', 'co.nz', 'com.br', 'com.mx',
        'co.jp', 'com.cn', 'com.hk', 'co.in', 'com.sg', 'com.my',
        'co.th', 'com.vn', 'com.ph', 'co.id', 'com.tr', 'co.kr'
      ]
      
      // Check if hostname ends with a multi-part TLD
      let domainParts: string[] = []
      let foundMultiPartTld = false
      
      for (const tld of multiPartTlds) {
        if (cleanHostname.endsWith('.' + tld)) {
          const withoutTld = cleanHostname.slice(0, -(tld.length + 1))
          domainParts = withoutTld.split('.')
          domainParts.push(tld)
          foundMultiPartTld = true
          break
        }
      }
      
      if (!foundMultiPartTld) {
        // Standard single-part TLD handling
        domainParts = cleanHostname.split('.')
      }
      
      if (domainParts.length >= 2) {
        // Get the domain name (second-to-last part) and TLD (last part or multi-part)
        const domainName = domainParts[domainParts.length - 2]
        const tld = domainParts[domainParts.length - 1]
        // Capitalize first letter of domain name and combine with TLD
        const capitalizedDomain = domainName.charAt(0).toUpperCase() + domainName.slice(1)
        return `${capitalizedDomain}.${tld}`
      }
      
      // Fallback: capitalize first letter of the whole hostname
      return cleanHostname.charAt(0).toUpperCase() + cleanHostname.slice(1)
    } catch {
      return 'original website'
    }
  }

  const getCardIcon = (cardKey: string) => {
    switch (cardKey) {
      case 'student_friendly':
        return <GraduationCap className="w-4 h-4" />
      case 'floor_type':
        return <Square className="w-4 h-4" />
      case 'natural_light':
        return <Sun className="w-4 h-4" />
      case 'noise_level':
        return <Volume1 className="w-4 h-4" />
      case 'renovation_state':
        return <PaintRoller className="w-4 h-4" />
      case 'balcony':
        return <Fence className="w-4 h-4" />
      case 'pet_friendly':
        return <PawPrint className="w-4 h-4" />
      case 'furnishing':
        return <Armchair className="w-4 h-4" />
      default:
        return null
    }
  }

  // Collect all cards with their data
  const aiCards = useMemo(() => {
    if (!metadata) return []
    const cards: Array<{
      key: string
      title: string
      evidence: string | null
      additionalContent?: string
      renderContent: () => ReactNode
    }> = []

    if (metadata?.student_friendly !== undefined || metadata?.evidence?.student_friendly) {
      const title = formatCardTitle('student_friendly', metadata?.student_friendly)
      let evidence = metadata?.evidence?.student_friendly || null
      // Remove "defaulting to true" text from evidence and trailing dashes
      if (evidence && typeof evidence === 'string') {
        evidence = evidence.replace(/defaulting to true/gi, '').trim()
        // Remove trailing dashes and whitespace
        evidence = evidence.replace(/[-–—]\s*$/, '').trim()
        if (evidence === '') evidence = null
      }
      cards.push({
        key: 'student_friendly',
        title,
        evidence,
        renderContent: () => (
          <>
            <div className="mb-2 flex items-center gap-2">
              {getCardIcon('student_friendly')}
              <span className="text-sm text-black font-medium">{title}</span>
            </div>
            {evidence && <p className="text-sm text-gray-500">{evidence}</p>}
          </>
        )
      })
    }

    if (metadata?.floor_type || metadata?.evidence?.floor_type) {
      const title = formatCardTitle('floor_type', metadata?.floor_type)
      const evidence = metadata?.evidence?.floor_type || null
      cards.push({
        key: 'floor_type',
        title,
        evidence,
        renderContent: () => (
          <>
            <div className="mb-2 flex items-center gap-2">
              {getCardIcon('floor_type')}
              <span className="text-sm text-black font-medium">{title}</span>
            </div>
            {evidence && <p className="text-sm text-gray-500">{evidence}</p>}
          </>
        )
      })
    }

    if (metadata?.natural_light || metadata?.evidence?.natural_light) {
      const title = formatCardTitle('natural_light', metadata?.natural_light)
      const evidence = metadata?.evidence?.natural_light || null
      cards.push({
        key: 'natural_light',
        title,
        evidence,
        renderContent: () => (
          <>
            <div className="mb-2 flex items-center gap-2">
              {getCardIcon('natural_light')}
              <span className="text-sm text-black font-medium">{title}</span>
            </div>
            {evidence && <p className="text-sm text-gray-500">{evidence}</p>}
          </>
        )
      })
    }

    if (metadata?.noise_level || metadata?.evidence?.noise_level) {
      const title = formatCardTitle('noise_level', metadata?.noise_level)
      const evidence = metadata?.evidence?.noise_level || null
      cards.push({
        key: 'noise_level',
        title,
        evidence,
        renderContent: () => (
          <>
            <div className="mb-2 flex items-center gap-2">
              {getCardIcon('noise_level')}
              <span className="text-sm text-black font-medium">{title}</span>
            </div>
            {evidence && <p className="text-sm text-gray-500">{evidence}</p>}
          </>
        )
      })
    }

    if (metadata?.renovation_state || metadata?.evidence?.renovation_state) {
      const title = formatCardTitle('renovation_state', metadata?.renovation_state)
      const evidence = metadata?.evidence?.renovation_state || null
      cards.push({
        key: 'renovation_state',
        title,
        evidence,
        renderContent: () => (
          <>
            <div className="mb-2 flex items-center gap-2">
              {getCardIcon('renovation_state')}
              <span className="text-sm text-black font-medium">{title}</span>
            </div>
            {evidence && <p className="text-sm text-gray-500">{evidence}</p>}
          </>
        )
      })
    }

    if (metadata?.furnishing || (metadata?.beds_single !== null && metadata?.beds_single !== undefined && metadata.beds_single > 0) || (metadata?.beds_double !== null && metadata?.beds_double !== undefined && metadata.beds_double > 0)) {
      const title = metadata?.furnishing ? formatCardTitle('furnishing', metadata.furnishing) : 'Furnishing'
      const bedsSingle = metadata?.beds_single !== null && metadata?.beds_single !== undefined && metadata.beds_single > 0 
        ? `${metadata.beds_single} ${metadata.beds_single > 1 ? 'single beds' : 'single bed'}` 
        : ''
      const bedsDouble = metadata?.beds_double !== null && metadata?.beds_double !== undefined && metadata.beds_double > 0
        ? `${metadata.beds_double} ${metadata.beds_double > 1 ? 'double beds' : 'double bed'}`
        : ''
      const additionalContent = [bedsSingle, bedsDouble].filter(Boolean).join('\n')
      cards.push({
        key: 'furnishing',
        title,
        evidence: null,
        additionalContent,
        renderContent: () => (
          <>
            <div className="mb-2 flex items-center gap-2">
              {getCardIcon('furnishing')}
              <span className="text-sm text-black font-medium">{title}</span>
            </div>
            <div className="text-sm text-gray-500">
              {bedsSingle && <div>{bedsSingle}</div>}
              {bedsDouble && <div>{bedsDouble}</div>}
            </div>
          </>
        )
      })
    }

    // Pet friendly card - show if metadata exists, default to true if not mentioned (like balcony but defaults to true)
    if (metadata?.pet_friendly !== undefined || metadata?.evidence?.pet_friendly) {
      // Default to true if not explicitly set to true or false (unlike balcony which defaults to false)
      const petFriendlyValue = (metadata?.pet_friendly === true || metadata?.pet_friendly === false) 
        ? metadata.pet_friendly 
        : true
      const title = formatCardTitle('pet_friendly', petFriendlyValue)
      let evidence = metadata?.evidence?.pet_friendly || null
      
      // If no evidence and pet_friendly is null/undefined, provide default explanation (like balcony)
      if (!evidence && (metadata?.pet_friendly === null || metadata?.pet_friendly === undefined)) {
        evidence = "The listing doesn't mention pets"
      }
      
      // Remove "defaulting to" text from evidence
      if (evidence && typeof evidence === 'string') {
        evidence = evidence.replace(/defaulting to (true|false)/gi, '').trim()
        // Remove trailing dashes and whitespace
        evidence = evidence.replace(/[-–—]\s*$/, '').trim()
        if (evidence === '') {
          // If evidence becomes empty after removing "defaulting to", use default explanation
          evidence = "The listing doesn't mention pets"
        }
      }
      
      cards.push({
        key: 'pet_friendly',
        title,
        evidence,
        renderContent: () => (
          <>
            <div className="mb-2 flex items-center gap-2">
              {getCardIcon('pet_friendly')}
              <span className="text-sm text-black font-medium">{title}</span>
            </div>
            {evidence && <p className="text-sm text-gray-500">{evidence}</p>}
          </>
        )
      })
    }

    // Balcony card
    if (metadata?.balcony !== undefined || metadata?.evidence?.balcony) {
      // Default to false if not explicitly set (unlike pet_friendly which defaults to true)
      const balconyValue = metadata?.balcony !== undefined ? metadata.balcony : false
      const title = formatCardTitle('balcony', balconyValue)
      let evidence = metadata?.evidence?.balcony || null
      
      // Always use natural language for evidence - override any backend text
      if (balconyValue === false || balconyValue === null || metadata?.balcony === null || metadata?.balcony === undefined) {
        evidence = "The listing doesn't mention a balcony"
      } else if (balconyValue === true && !evidence) {
        // If true but no evidence, use a generic positive message
        evidence = "The listing mentions a balcony"
      }
      
      // Clean up any "defaulting to" or broken English from backend
      if (evidence && typeof evidence === 'string') {
        // Remove "defaulting to" text
        evidence = evidence.replace(/defaulting to (true|false)/gi, '').trim()
        // Fix common broken English patterns
        evidence = evidence.replace(/no mention of balcony/gi, "The listing doesn't mention a balcony")
        evidence = evidence.replace(/no mentions of balcony/gi, "The listing doesn't mention a balcony")
        evidence = evidence.replace(/no mention of a? balcony/gi, "The listing doesn't mention a balcony")
        if (evidence === '' || evidence.toLowerCase().includes('no mention')) {
          evidence = "The listing doesn't mention a balcony"
        }
      }
      cards.push({
        key: 'balcony',
        title,
        evidence,
        renderContent: () => (
          <>
            <div className="mb-2 flex items-center gap-2">
              {getCardIcon('balcony')}
              <span className="text-sm text-black font-medium">{title}</span>
            </div>
            {evidence && <p className="text-sm text-gray-500">{evidence}</p>}
          </>
        )
      })
    }

    // Filter by visibility preferences
    const visibleCardsList = cards.filter(card => visibleCards.has(card.key))

    // Limit to maximum 6 cards (2 rows of 3)
    const limitedCards = visibleCardsList.slice(0, 6)

    // Return cards with fixed span of 3 (3 cards per row in 9-column grid)
    return limitedCards.map(card => ({ card, span: 3 }))
  }, [metadata, visibleCards])

  if (!isOpen || !listing) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/10 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          <div className="flex gap-6 items-stretch">
            {/* Left Column - Images */}
            {images && images.length > 0 && (
              <div className="flex-shrink-0 w-[45%]" ref={imageContainerRef}>
                <div className="relative aspect-square bg-gray-100 rounded-[20px] overflow-hidden group w-full">
                  <img
                    src={images[currentImageIndex]}
                    alt={`Listing image ${currentImageIndex + 1} of ${images.length}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  {images.length > 1 && (
                    <>
                      {/* Left Arrow */}
                      <button
                        onClick={prevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all opacity-0 group-hover:opacity-100"
                        aria-label="Previous image"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      {/* Right Arrow */}
                      <button
                        onClick={nextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all opacity-0 group-hover:opacity-100"
                        aria-label="Next image"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {/* Image Counter */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded transition-all opacity-0 group-hover:opacity-100">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Right Column - Price/Address and AI Inferred Attributes */}
            <div className="flex-shrink-0 w-[55%] flex flex-col pr-4 h-full justify-between" ref={rightColumnRef}>
              <div className="flex-shrink-0">
                {/* Price, Address, and Google Maps Link */}
                <div className="space-y-2">
                {metadata?.price && (
                  <div className="text-[24px] font-bold">
                    {formatPrice(metadata.price, isRental(), metadata.currency)}
                  </div>
                )}
                {metadata?.address && (metadata?.latitude && metadata?.longitude) ? (
                  <a
                    href={`https://www.google.com/maps?q=${metadata.latitude},${metadata.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-black hover:underline flex items-center gap-1.5"
                  >
                    <MapPin className="w-4 h-4" />
                    {metadata.address}
                  </a>
                ) : metadata?.address ? (
                  <div className="text-[14px] text-black flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {metadata.address}
                  </div>
                ) : null}
              </div>
              
              {/* Basic Information Pills */}
              <div className="mt-6">
                <div className="flex flex-wrap gap-2">
                  {metadata?.size_sqm && formatSize(metadata.size_sqm, metadata.size_unit) && (
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm">{formatSize(metadata.size_sqm, metadata.size_unit)}</span>
                  )}
                  {metadata?.rooms && (
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm">{metadata.rooms} {metadata.rooms > 1 ? 'rooms' : 'room'}</span>
                  )}
                  {metadata?.bedrooms !== null && metadata?.bedrooms !== undefined && metadata.bedrooms > 0 && (
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1">
                      <BedDouble className="w-4 h-4" />
                      {metadata.bedrooms}
                    </span>
                  )}
                  {metadata?.bathrooms !== null && metadata?.bathrooms !== undefined && metadata.bathrooms > 0 && (
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      {metadata.bathrooms}
                    </span>
                  )}
                  {metadata?.condo_fees && (
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {formatPrice(metadata.condo_fees, false, metadata.currency)}/mo
                    </span>
                  )}
                  {/* Vibe Tags */}
                  {metadata?.vibe_tags && metadata.vibe_tags.length > 0 && (
                    <>
                      {metadata.vibe_tags.map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {tag}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
              </div>
              
              {/* Go to Original Website Button - Centered between pills and cards */}
              {listing?.source_url && (
                <div className="flex-1 flex flex-col justify-center items-start">
                  <a
                    href={listing.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 bg-black text-white rounded-[20px] text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    Go to {getWebsiteName(listing.source_url)}
                  </a>
                </div>
              )}
              
              {/* Dream Apartment Match or AI Inferred Attributes */}
              <div className="flex-shrink-0 relative">
                {hasDreamApartment ? (
                  // Show Dream Apartment Comparison
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-[20px] p-5">
                    <div className="flex items-start gap-4">
                      {/* Score Badge */}
                      {matchScore !== undefined ? (
                        <div 
                          className="flex-shrink-0 px-4 py-2 rounded-[30px] flex items-center gap-3 backdrop-blur-md bg-black/60 border border-white/15 shadow-lg"
                          style={{ backdropFilter: 'blur(12px)' }}
                        >
                          <div className={`w-3 h-3 rounded-full ${getScoreColor(matchScore)}`}></div>
                          <span className="text-2xl font-bold text-white">{matchScore}</span>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center bg-gray-200 text-gray-400">
                          {isEvaluatingListing ? (
                            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span className="text-lg font-medium text-gray-500">—</span>
                          )}
                        </div>
                      )}
                      
                      {/* Summary Text */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <House className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Dream Apartment Match</span>
                          <Sparkles className="w-3 h-3 text-gray-400" />
                        </div>
                        {comparisonSummary ? (
                          <p className="text-sm text-gray-600 leading-relaxed">{comparisonSummary}</p>
                        ) : matchScore !== undefined ? (
                          <p className="text-sm text-gray-500 italic">Comparison complete. Summary being generated...</p>
                        ) : isEvaluatingListing ? (
                          <p className="text-sm text-gray-600">Evaluating this listing… usually 15–30 seconds.</p>
                        ) : onEvaluateListing ? (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">No score yet. Evaluate this listing to see how it matches your dream apartment.</p>
                            <button
                              type="button"
                              onClick={onEvaluateListing}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                            >
                              <Sparkles className="w-4 h-4" />
                              Get match score
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">AI is evaluating this listing. This may take a moment…</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Show prompt to set up dream apartment (when no dream apartment is set)
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[20px] p-5 border border-blue-100">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <House className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-800 mb-1">Describe your dream apartment</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Get AI-powered match scores for each listing based on your ideal home.
                        </p>
                        {onOpenDreamApartment && (
                          <button
                            onClick={onOpenDreamApartment}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            <Sparkles className="w-4 h-4" />
                            Set Up Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


