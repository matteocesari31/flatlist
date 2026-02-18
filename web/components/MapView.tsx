'use client'

import { useEffect, useRef, useState } from 'react'
import { ListingWithMetadata } from '@/lib/types'
import { parseTransitLineFromText, fetchTransitRouteGeometry } from '@/lib/transit-line'

export interface MapViewProps {
  viewMode: 'list' | 'map'
  listings: ListingWithMetadata[]
  listingComparisons: Map<string, { score: number; summary: string }>
  hasDreamApartment: boolean
  dreamApartmentDescription: string | null
  showTransitLine?: boolean
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

function getListingImage(listing: ListingWithMetadata): string | null {
  let imagesArray: string[] | null = null
  if (listing.images) {
    if (Array.isArray(listing.images)) {
      imagesArray = listing.images
    } else if (typeof listing.images === 'string') {
      try {
        imagesArray = JSON.parse(listing.images)
      } catch {
        imagesArray = null
      }
    } else if (typeof listing.images === 'object' && listing.images !== null) {
      imagesArray = Object.values(listing.images) as string[]
    }
  }
  return imagesArray && imagesArray.length > 0 ? imagesArray[0] : null
}

const TRANSIT_SOURCE_ID = 'transit-line-highlight'
const TRANSIT_LAYER_ID = 'transit-line-highlight'

export default function MapView({ viewMode, listings, listingComparisons, hasDreamApartment, dreamApartmentDescription, showTransitLine = true, onListingClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('mapbox-gl').Map | null>(null)
  const markersRef = useRef<Map<string, { marker: import('mapbox-gl').Marker; element: HTMLDivElement }>>(new Map<string, { marker: import('mapbox-gl').Marker; element: HTMLDivElement }>())
  const [hoverPreview, setHoverPreview] = useState<{ listing: ListingWithMetadata; x: number; y: number } | null>(null)
  const setHoverPreviewRef = useRef(setHoverPreview)
  setHoverPreviewRef.current = setHoverPreview
  const [mapReady, setMapReady] = useState(false)
  const setMapReadyRef = useRef(setMapReady)
  setMapReadyRef.current = setMapReady
  const [transitGeo, setTransitGeo] = useState<GeoJSON.FeatureCollection | null>(null)

  // When switching back to map view, resize the map so it fills the container (it was hidden with display:none)
  useEffect(() => {
    if (viewMode === 'map' && mapRef.current) {
      mapRef.current.resize()
    }
  }, [viewMode])

  // Parse dream apartment text for transit line and fetch route geometry from OSM
  useEffect(() => {
    const parsed = parseTransitLineFromText(dreamApartmentDescription)
    if (!parsed) {
      setTransitGeo(null)
      return
    }
    const listingsWithCoords = listings.filter((listing) => {
      const metadata = listing.listing_metadata?.[0]
      return metadata?.latitude != null && metadata?.longitude != null
    })
    let bbox: [number, number, number, number] | undefined
    if (listingsWithCoords.length > 0) {
      const lngs: number[] = []
      const lats: number[] = []
      for (const l of listingsWithCoords) {
        const m = l.listing_metadata?.[0]
        if (m?.longitude != null && m?.latitude != null) {
          lngs.push(m.longitude)
          lats.push(m.latitude)
        }
      }
      if (lngs.length && lats.length) {
        const pad = 0.05
        bbox = [
          Math.min(...lngs) - pad,
          Math.min(...lats) - pad,
          Math.max(...lngs) + pad,
          Math.max(...lats) + pad,
        ]
      }
    }
    let cancelled = false
    fetchTransitRouteGeometry(parsed.routeType, parsed.ref, bbox).then((fc) => {
      if (!cancelled) setTransitGeo(fc)
    })
    return () => {
      cancelled = true
    }
  }, [dreamApartmentDescription, listings])

  // Transit line as a Mapbox layer (single line, no glow). slot: 'top' places it in the style's top slot.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const removeLayer = () => {
      try {
        if (map.getLayer(TRANSIT_LAYER_ID)) map.removeLayer(TRANSIT_LAYER_ID)
        if (map.getSource(TRANSIT_SOURCE_ID)) map.removeSource(TRANSIT_SOURCE_ID)
      } catch (_) {}
    }

    if (showTransitLine && transitGeo && transitGeo.features.length > 0) {
      removeLayer()
      map.addSource(TRANSIT_SOURCE_ID, {
        type: 'geojson',
        data: transitGeo,
      })
      map.addLayer(
        {
          id: TRANSIT_LAYER_ID,
          type: 'line',
          source: TRANSIT_SOURCE_ID,
          slot: 'top',
          paint: {
            'line-color': '#00e5ff',
            'line-width': 5,
            'line-opacity': 1,
          },
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
        }
      )
    } else {
      removeLayer()
    }
    return removeLayer
  }, [mapReady, transitGeo, showTransitLine])

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

        // Calculate bounds from all listings (no padding - fitBounds will add minimal padding)
        let bounds: [[number, number], [number, number]] | null = null
        if (listingsWithCoords.length > 0) {
          const lngs: number[] = []
          const lats: number[] = []
          listingsWithCoords.forEach(listing => {
            const metadata = listing.listing_metadata?.[0]
            if (metadata?.longitude != null && metadata?.latitude != null) {
              lngs.push(metadata.longitude)
              lats.push(metadata.latitude)
            }
          })
          if (lngs.length > 0 && lats.length > 0) {
            // Use exact bounds - fitBounds will add minimal padding
            bounds = [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)]
            ]
          }
        }

        // Default center (Milan) if no listings with coords
        let centerLng = 9.1859
        let centerLat = 45.4642
        const targetZoom = 12 // Target zoom level after animation (fallback if no bounds)

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

        // Start at globe level (zoom 1), then ease to angled view like detail panel
        mapInstance = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/standard',
          center: [centerLng, centerLat],
          zoom: 1, // Globe level
          pitch: 0,
          bearing: 0,
          config: {
            basemap: {
              lightPreset: 'dusk',
            },
          },
        })

        mapRef.current = mapInstance
        console.log('MapView: Map instance created')

        // Clustering function: detect overlaps and create aggregated markers
        const updateMarkers = () => {
            if (!mounted || !mapInstance || listingsWithCoords.length === 0) {
              // Still need to define it for the event listeners
              return
            }

            // Remove all existing markers
            markersRef.current.forEach(({ marker }) => {
              try {
                marker.remove()
              } catch (e) {
                // Ignore cleanup errors
              }
            })
            markersRef.current.clear()

            // Prepare marker data with screen positions
            const markerData = listingsWithCoords.map(listing => {
              const metadata = listing.listing_metadata?.[0]
              if (!metadata?.latitude || !metadata?.longitude) return null

              const matchScore = hasDreamApartment ? listingComparisons.get(listing.id)?.score : undefined
              const point = mapInstance!.project([metadata.longitude, metadata.latitude])
              
              return {
                listing,
                score: matchScore ?? 0,
                lngLat: [metadata.longitude, metadata.latitude] as [number, number],
                screenX: point.x,
                screenY: point.y,
                metadata
              }
            }).filter((item): item is NonNullable<typeof item> => item !== null)

            // Cluster markers that overlap (within 50px of each other)
            const CLUSTER_DISTANCE = 50
            const clusters: Array<Array<typeof markerData[0]>> = []
            const processed = new Set<number>()

            markerData.forEach((marker, index) => {
              if (processed.has(index)) return

              const cluster = [marker]
              processed.add(index)

              // Find all markers within cluster distance
              markerData.forEach((otherMarker, otherIndex) => {
                if (processed.has(otherIndex) || index === otherIndex) return

                const dx = marker.screenX - otherMarker.screenX
                const dy = marker.screenY - otherMarker.screenY
                const distance = Math.sqrt(dx * dx + dy * dy)

                if (distance < CLUSTER_DISTANCE) {
                  cluster.push(otherMarker)
                  processed.add(otherIndex)
                }
              })

              clusters.push(cluster)
            })

            // Create markers for each cluster
            clusters.forEach(cluster => {
              if (cluster.length === 0) return

              // Sort by score (highest first) to get the best one
              cluster.sort((a, b) => b.score - a.score)
              const primaryMarker = cluster[0]
              const hiddenCount = cluster.length - 1

              // Create marker element
              const el = document.createElement('div')
              el.className = 'cursor-pointer'
              el.style.width = 'fit-content'
              el.style.height = 'fit-content'

              if (hasDreamApartment && primaryMarker.score > 0) {
                // Create AI score tag marker with +n if clustered
                const scoreColor = getScoreColor(primaryMarker.score)
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
                    ">${primaryMarker.score}</span>
                    ${hiddenCount > 0 ? `<span style="
                      font-size: 0.75rem;
                      font-weight: 500;
                      color: rgba(255, 255, 255, 0.7);
                      margin-left: 0.125rem;
                    ">+${hiddenCount}</span>` : ''}
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

              // Add click handler - open the primary (highest score) listing
              const handleClick = (e: MouseEvent) => {
                e.stopPropagation()
                onListingClick(primaryMarker.listing)
              }
              el.addEventListener('click', handleClick)
              ;(el as any)._clickHandler = handleClick

              // Hover preview: show listing image above the tag (position fixed when hover starts)
              const handleMouseEnter = () => {
                const rect = el.getBoundingClientRect()
                const tagCenterX = rect.left + rect.width / 2
                const tagTop = rect.top
                setHoverPreviewRef.current?.({ listing: primaryMarker.listing, x: tagCenterX, y: tagTop })
              }
              const handleMouseLeave = () => {
                setHoverPreviewRef.current?.(null)
              }
              el.addEventListener('mouseenter', handleMouseEnter)
              el.addEventListener('mouseleave', handleMouseLeave)
              ;(el as any)._mouseEnterHandler = handleMouseEnter
              ;(el as any)._mouseLeaveHandler = handleMouseLeave

              // Create marker at the primary marker's location
              const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                .setLngLat(primaryMarker.lngLat)
                .addTo(mapInstance!)

              // Store using primary marker's listing ID
              markersRef.current.set(primaryMarker.listing.id, { marker, element: el })
            })
          }

        // Animate zoom from globe level to target zoom, then create markers (dusk preset is set via config at init)
        mapInstance.on('load', () => {
          console.log('MapView: Map loaded event fired')
          if (!mounted || !mapInstance) {
            console.log('MapView: Map load handler aborted - not mounted or no instance')
            return
          }
          setMapReadyRef.current?.(true)

          // Animate zoom from globe level to fit bounds or target zoom, then create markers
          setTimeout(() => {
            if (!mounted || !mapInstance) return

            if (bounds && listingsWithCoords.length > 0) {
              // Fit bounds to show all listings
              console.log('MapView: Fitting bounds to show all listings', bounds)
              
              // Calculate camera options for bounds, then animate with pitch/bearing
              const cameraOptions = mapInstance.cameraForBounds(bounds, {
                padding: { top: 5, bottom: 5, left: 5, right: 5 }, // Very minimal padding
                maxZoom: 18 // Allow zooming in quite a bit
              })
              
              if (cameraOptions) {
                // Animate to the calculated camera position with pitch and bearing
                mapInstance.easeTo({
                  center: cameraOptions.center,
                  zoom: cameraOptions.zoom,
                  pitch: 60,   // Angled view like detail panel (ListingMap)
                  bearing: -17,
                  duration: 4000, // 4 second animation
                  easing: (t) => {
                    // Ease-out cubic function for smooth deceleration
                    return 1 - Math.pow(1 - t, 3)
                  }
                })
              } else {
                // Fallback: calculate center manually and use default zoom
                const centerLng = (bounds[0][0] + bounds[1][0]) / 2
                const centerLat = (bounds[0][1] + bounds[1][1]) / 2
                mapInstance.easeTo({
                  center: [centerLng, centerLat],
                  zoom: 12,
                  pitch: 60,
                  bearing: -17,
                  duration: 4000,
                  easing: (t) => {
                    return 1 - Math.pow(1 - t, 3)
                  }
                })
              }

              // Create markers after zoom animation completes
              setTimeout(() => {
                updateMarkers()
              }, 4100) // After animation completes
            } else {
              // Fallback to center/zoom if no bounds
              console.log('MapView: Animating zoom from 1 to', targetZoom, 'at center', [centerLng, centerLat])
              mapInstance.easeTo({
                center: [centerLng, centerLat],
                zoom: targetZoom,
                pitch: 60,   // Angled view like detail panel (ListingMap)
                bearing: -17,
                duration: 4000, // 4 second animation
                easing: (t) => {
                  // Ease-out cubic function for smooth deceleration
                  return 1 - Math.pow(1 - t, 3)
                }
              })

              // Create markers after zoom animation completes
              setTimeout(() => {
                updateMarkers()
              }, 4100) // Slightly longer than animation duration
            }
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

        // Recalculate clusters when map moves or zooms
        const updateClusters = () => {
          if (!mounted || !mapInstance) return
          // Small debounce to avoid too many recalculations
          clearTimeout((mapInstance as any)._clusterUpdateTimer)
          ;(mapInstance as any)._clusterUpdateTimer = setTimeout(() => {
            if (mounted && mapInstance) {
              updateMarkers()
            }
          }, 100)
        }

        mapInstance.on('moveend', updateClusters)
        mapInstance.on('zoomend', updateClusters)
        mapInstance.on('rotateend', updateClusters)
        mapInstance.on('pitchend', updateClusters)
      } catch (error) {
        console.error('MapView: Error initializing map:', error)
      }
    }

    // Small delay to ensure container is rendered
    const timer = setTimeout(checkContainer, 100)

    return () => {
      mounted = false
      setMapReadyRef.current?.(false)
      clearTimeout(timer)
      // Clean up markers
      markersRef.current.forEach(({ marker, element }) => {
        try {
          const clickHandler = (element as any)?._clickHandler
          if (clickHandler) element.removeEventListener('click', clickHandler)
          const mouseEnter = (element as any)?._mouseEnterHandler
          if (mouseEnter) element.removeEventListener('mouseenter', mouseEnter)
          const mouseLeave = (element as any)?._mouseLeaveHandler
          if (mouseLeave) element.removeEventListener('mouseleave', mouseLeave)
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
      <div className="fixed inset-0 flex items-center justify-center text-gray-400 text-sm bg-[#0B0B0B] z-10">
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
      <div className="fixed inset-0 flex items-center justify-center text-gray-400 text-sm bg-[#0B0B0B] z-10">
        No listings with location data available ({listings.length} total listings)
      </div>
    )
  }

  const PREVIEW_WIDTH = 200
  const PREVIEW_HEIGHT = 150
  const PREVIEW_GAP = 12
  const imageUrl = hoverPreview ? getListingImage(hoverPreview.listing) : null

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-10"
        style={{ width: '100vw', height: '100vh' }}
      />
      {hoverPreview && (
        <div
          className="fixed z-20 pointer-events-none"
          style={{
            left: hoverPreview.x,
            top: hoverPreview.y - PREVIEW_HEIGHT - PREVIEW_GAP,
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            transform: 'translate(-50%, 0)',
          }}
        >
          <div className="w-full h-full rounded-[30px] overflow-hidden bg-black/40 border border-white/15 shadow-xl">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
                No image
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
