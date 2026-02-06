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
    if (!token) {
      console.log('MapView: No token available')
      return
    }

    console.log('MapView: Effect running, listings count:', listings.length)
    
    let mounted = true
    let mapInstance: import('mapbox-gl').Map | null = null

    // Wait for container to be available
    const checkContainer = () => {
      if (!mounted) return
      
      if (!containerRef.current) {
        console.log('MapView: Container ref not available yet, retrying...')
        setTimeout(checkContainer, 50)
        return
      }

      console.log('MapView: Container found, dimensions:', {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
        visible: containerRef.current.offsetWidth > 0 && containerRef.current.offsetHeight > 0
      })

      if (containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
        console.warn('MapView: Container has zero dimensions!')
      }

      init()
    }

    const init = async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default

        if (!mounted || !containerRef.current) {
          console.log('MapView: Aborted - not mounted or no container')
          return
        }

        console.log('MapView: Mapbox loaded, setting token and creating map')
        mapboxgl.accessToken = token

        // Filter listings with valid coordinates
        const listingsWithCoords = listings.filter(listing => {
          const metadata = listing.listing_metadata?.[0]
          return metadata?.latitude != null && metadata?.longitude != null &&
                 Number.isFinite(metadata.latitude) && Number.isFinite(metadata.longitude)
        })

        // Default center (Milan) if no listings with coords
        let centerLng = 9.1859
        let centerLat = 45.4642
        const targetZoom = 12 // Target zoom level after animation

        if (!mounted || !containerRef.current) {
          console.log('MapView: Aborted before map creation')
          return
        }

        console.log('MapView: Creating map instance', {
          container: containerRef.current,
          center: [centerLng, centerLat],
          zoom: 1, // Start at globe level
          listingsCount: listingsWithCoords.length
        })

        // Start at globe level (zoom 1)
        mapInstance = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/standard',
          center: [centerLng, centerLat],
          zoom: 1, // Globe level
          pitch: 0,
          bearing: 0,
        })

        mapRef.current = mapInstance
        console.log('MapView: Map instance created')

        // Set time of day to dusk and animate zoom
        mapInstance.on('load', () => {
          console.log('MapView: Map loaded event fired')
          if (!mounted || !mapInstance) {
            console.log('MapView: Map load handler aborted - not mounted or no instance')
            return
          }
          try {
            mapInstance.setConfigProperty('basemap', 'lightPreset', 'dusk')
            console.log('MapView: Dusk preset applied')
          } catch (error) {
            console.warn('Failed to set map light preset:', error)
          }

          // Create custom markers for each listing after map loads
          const createMarkers = () => {
            if (!mounted || !mapInstance || listingsWithCoords.length === 0) return
            
            listingsWithCoords.forEach(listing => {
              if (!mounted || !mapInstance) return
              
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

              // Add click handler - use a stable reference
              const handleClick = (e: MouseEvent) => {
                e.stopPropagation()
                onListingClick(listing)
              }
              el.addEventListener('click', handleClick)
              
              // Store handler for cleanup
              ;(el as any)._clickHandler = handleClick

              // Create marker
              const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                .setLngLat([metadata.longitude, metadata.latitude])
                .addTo(mapInstance!)

              markersRef.current.set(listing.id, { marker, element: el })
            })
          }

          // Animate zoom from globe level to target zoom, then create markers
          setTimeout(() => {
            if (!mounted || !mapInstance) return

            console.log('MapView: Animating zoom from 1 to', targetZoom, 'at center', [centerLng, centerLat])
            mapInstance.easeTo({
              center: [centerLng, centerLat],
              zoom: targetZoom,
              duration: 2000, // 2 second animation
              easing: (t) => {
                // Ease-out cubic function for smooth deceleration
                return 1 - Math.pow(1 - t, 3)
              }
            })

            // Create markers after zoom animation completes
            setTimeout(() => {
              createMarkers()
            }, 2100) // Slightly longer than animation duration
          }, 500) // Small delay after map loads
        })

        // Handle map errors
        mapInstance.on('error', (e) => {
          console.error('MapView: Mapbox error:', e)
        })

        mapInstance.on('style.load', () => {
          console.log('MapView: Map style loaded')
        })

        mapInstance.on('render', () => {
          if (mapInstance?.loaded()) {
            console.log('MapView: Map rendered and loaded')
          }
        })
      } catch (error) {
        console.error('MapView: Error initializing map:', error)
      }
    }

    // Small delay to ensure container is rendered
    const timer = setTimeout(checkContainer, 100)

    return () => {
      mounted = false
      clearTimeout(timer)
      // Clean up markers
      markersRef.current.forEach(({ marker, element }) => {
        try {
          // Remove click handler
          const handler = (element as any)?._clickHandler
          if (handler) {
            element.removeEventListener('click', handler)
          }
          marker.remove()
        } catch (e) {
          // Ignore cleanup errors
        }
      })
      markersRef.current.clear()
      // Clean up map
      if (mapInstance) {
        try {
          mapInstance.remove()
        } catch (e) {
          // Ignore cleanup errors
        }
        mapInstance = null
        mapRef.current = null
      }
    }
  }, [token, listings, listingComparisons, hasDreamApartment, onListingClick])

  if (!token) {
    return (
      <div className="fixed inset-0 top-16 flex items-center justify-center text-gray-400 text-sm bg-[#0D0D0D] z-10">
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
      <div className="fixed inset-0 top-16 flex items-center justify-center text-gray-400 text-sm bg-[#0D0D0D] z-10">
        No listings with location data available ({listings.length} total listings)
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-[#0D0D0D] z-10"
      style={{ width: '100vw', height: 'calc(100vh - 4rem)' }}
    />
  )
}
