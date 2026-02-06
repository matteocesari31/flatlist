'use client'

import { useEffect, useRef } from 'react'
import { ListingWithMetadata } from '@/lib/types'

interface MapViewProps {
  listings: ListingWithMetadata[]
  listingComparisons: Map<string, { score: number; summary: string }>
  hasDreamApartment: boolean
  onListingClick: (listing: ListingWithMetadata) => void
}

// Helper function to get score color and glow based on value (same as ListingCard)
function getScoreColor(score: number): { bg: string; glow: string } {
  if (score >= 70) {
    return { bg: 'bg-green-500', glow: '0 0 10px 3px rgba(34, 197, 94, 0.55)' }
  } else if (score >= 40) {
    return { bg: 'bg-yellow-400', glow: '0 0 10px 3px rgba(250, 204, 21, 0.55)' }
  } else {
    return { bg: 'bg-red-400', glow: '0 0 10px 3px rgba(248, 113, 113, 0.55)' }
  }
}

export default function MapView({ listings, listingComparisons, hasDreamApartment, onListingClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('mapbox-gl').Map | null>(null)
  const markersRef = useRef<Map<string, { marker: import('mapbox-gl').Marker; element: HTMLDivElement }>>(new Map<string, { marker: import('mapbox-gl').Marker; element: HTMLDivElement }>())

  const token = (() => {
    const t = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    return t != null && String(t).trim() !== '' ? String(t).trim() : undefined
  })()

  useEffect(() => {
    if (!token || !containerRef.current) return

    let mounted = true

    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default

      if (!mounted || !containerRef.current) return

      mapboxgl.accessToken = token

      // Filter listings with valid coordinates
      const listingsWithCoords = listings.filter(listing => {
        const metadata = listing.listing_metadata?.[0]
        return metadata?.latitude != null && metadata?.longitude != null &&
               Number.isFinite(metadata.latitude) && Number.isFinite(metadata.longitude)
      })

      if (listingsWithCoords.length === 0) return

      // Calculate center from all listings
      const avgLat = listingsWithCoords.reduce((sum, l) => sum + (l.listing_metadata?.[0]?.latitude || 0), 0) / listingsWithCoords.length
      const avgLng = listingsWithCoords.reduce((sum, l) => sum + (l.listing_metadata?.[0]?.longitude || 0), 0) / listingsWithCoords.length

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/standard',
        center: [avgLng, avgLat],
        zoom: 12,
        pitch: 0,
        bearing: 0,
      })

      // Set time of day to dusk
      map.on('load', () => {
        try {
          map.setConfigProperty('basemap', 'lightPreset', 'dusk')
        } catch (error) {
          console.warn('Failed to set map light preset:', error)
        }
      })

      mapRef.current = map

      // Create custom markers for each listing
      listingsWithCoords.forEach(listing => {
        const metadata = listing.listing_metadata?.[0]
        if (!metadata?.latitude || !metadata?.longitude) return

        const matchScore = hasDreamApartment ? listingComparisons.get(listing.id)?.score : undefined

        // Create custom HTML element for marker (AI score tag)
        const el = document.createElement('div')
        el.className = 'cursor-pointer'
        el.style.width = 'fit-content'
        el.style.height = 'fit-content'

        if (hasDreamApartment && matchScore !== undefined) {
          // Create AI score tag marker
          const scoreColor = getScoreColor(matchScore)
          el.innerHTML = `
            <div style="
              display: flex;
              align-items: center;
              gap: 0.375rem;
              padding: 0.375rem 0.75rem;
              border-radius: 30px;
              backdrop-filter: blur(12px);
              background: rgba(0, 0, 0, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.15);
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
              cursor: pointer;
            ">
              <div style="
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: ${scoreColor.bg === 'bg-green-500' ? '#22c55e' : scoreColor.bg === 'bg-yellow-400' ? '#facc15' : '#f87171'};
                box-shadow: ${scoreColor.glow};
              "></div>
              <span style="
                font-size: 0.875rem;
                font-weight: 600;
                color: white;
              ">${matchScore}</span>
            </div>
          `
        } else {
          // Fallback: simple dot marker if no score
          el.innerHTML = `
            <div style="
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background-color: #ef4444;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
              cursor: pointer;
            "></div>
          `
        }

        // Add click handler
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onListingClick(listing)
        })

        // Create marker
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([metadata.longitude, metadata.latitude])
          .addTo(map)

        markersRef.current.set(listing.id, { marker, element: el })
      })
    }

    init()

    return () => {
      mounted = false
      // Clean up markers
      markersRef.current.forEach(({ marker }) => {
        marker.remove()
      })
      markersRef.current.clear()
      // Clean up map
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [token, listings, listingComparisons, hasDreamApartment, onListingClick])

  if (!token) {
    return (
      <div className="fixed inset-0 top-16 flex items-center justify-center text-gray-400 text-sm">
        Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to show map
      </div>
    )
  }

  const listingsWithCoords = listings.filter(listing => {
    const metadata = listing.listing_metadata?.[0]
    return metadata?.latitude != null && metadata?.longitude != null &&
           Number.isFinite(metadata.latitude) && Number.isFinite(metadata.longitude)
  })

  if (listingsWithCoords.length === 0) {
    return (
      <div className="fixed inset-0 top-16 flex items-center justify-center text-gray-400 text-sm">
        No listings with location data available
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 top-16"
    />
  )
}
