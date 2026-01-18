'use client'

import { ListingWithMetadata } from '@/lib/types'
import { useEffect, useState, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { BedDouble, Bath, Building, MapPin, GraduationCap, Square, Sun, Volume1, PaintRoller, Fence, PawPrint, Armchair, Ellipsis } from 'lucide-react'

interface MetadataViewerProps {
  listing: ListingWithMetadata | null
  isOpen: boolean
  onClose: () => void
}

export default function MetadataViewer({ listing, isOpen, onClose }: MetadataViewerProps) {
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

  const formatPrice = (price: number | null, isRent: boolean = false) => {
    if (!price) return 'N/A'
    const formatted = `€${price.toLocaleString('it-IT')}`
    return isRent ? `${formatted}/mo` : formatted
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
      // Extract the main domain name and TLD (e.g., "immobiliare.it" from "www.immobiliare.it")
      const parts = cleanHostname.split('.')
      if (parts.length >= 2) {
        // Get the domain name (second-to-last part) and TLD (last part)
        const domainName = parts[parts.length - 2]
        const tld = parts[parts.length - 1]
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
                    {formatPrice(metadata.price, isRental())}
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
                  {metadata?.size_sqm && (
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm">{metadata.size_sqm} m²</span>
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
                      {formatPrice(metadata.condo_fees)}/mo
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
              
              {/* AI Inferred Attributes */}
              <div className="flex-shrink-0 relative">
                {/* Card Selector Button - Absolutely positioned above cards, doesn't affect layout */}
                <div className="absolute -top-12 right-0 flex justify-end">
                  <button
                    ref={cardSelectorButtonRef}
                    onClick={() => {
                      if (cardSelectorButtonRef.current) {
                        const rect = cardSelectorButtonRef.current.getBoundingClientRect()
                        setPopupPosition({
                          top: rect.bottom + 8,
                          right: window.innerWidth - rect.right
                        })
                      }
                      setShowCardSelector(!showCardSelector)
                    }}
                    className="p-2 text-gray-700 border border-gray-300 rounded-[20px] hover:bg-gray-50 transition-colors flex items-center justify-center"
                    title="Customize Cards"
                  >
                    <Ellipsis className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Card Selector Popup */}
                {showCardSelector && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-[60]"
                      onClick={() => setShowCardSelector(false)}
                    />
                    {/* Popup - fixed positioning relative to button */}
                    <div 
                      className="fixed z-[70] bg-white rounded-[20px] px-6 pt-3 pb-6 shadow-2xl border border-gray-200" 
                      style={{ 
                        top: `${popupPosition.top}px`,
                        right: `${popupPosition.right}px`,
                        minWidth: '300px'
                      }}
                    >
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs text-gray-500">
                            Select up to 6 cards to display
                          </div>
                          <button
                            onClick={() => setShowCardSelector(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Close"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="space-y-2">
                          {[
                            { key: 'student_friendly', label: 'Student Friendly' },
                            { key: 'floor_type', label: 'Floor Type' },
                            { key: 'natural_light', label: 'Natural Light' },
                            { key: 'noise_level', label: 'Noise Level' },
                            { key: 'renovation_state', label: 'Renovation State' },
                            { key: 'furnishing', label: 'Furnishing' },
                            { key: 'pet_friendly', label: 'Pet Friendly' },
                            { key: 'balcony', label: 'Balcony' },
                          ].map(({ key, label }) => {
                            const isChecked = visibleCards.has(key)
                            const isDisabled = !isChecked && visibleCards.size >= 6
                            return (
                              <label 
                                key={key} 
                                className={`flex items-center gap-2 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCardVisibility(key)}
                                  disabled={isDisabled}
                                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black disabled:cursor-not-allowed"
                                />
                                <span className="text-sm text-gray-700">{label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}

                {/* Cards Grid */}
                <div className="grid grid-cols-9 gap-x-4 gap-y-1 auto-rows-min">
                  {aiCards.map(({ card, span }, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-[20px] p-4 flex flex-col"
                      style={{ gridColumn: `span ${span}` }}
                    >
                      {card.renderContent()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


