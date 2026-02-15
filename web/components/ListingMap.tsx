'use client'

import { useEffect, useRef } from 'react'

interface ListingMapProps {
  latitude: number | null
  longitude: number | null
  className?: string
}

export default function ListingMap({ latitude, longitude, className = '' }: ListingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ map: import('mapbox-gl').Map; marker: import('mapbox-gl').Marker } | null>(null)
  // Read at render so it picks up inlined NEXT_PUBLIC_ value; trim to avoid whitespace issues
  const token = (() => {
    const t = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    return t != null && String(t).trim() !== '' ? String(t).trim() : undefined
  })()

  const hasCoords = latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)

  useEffect(() => {
    if (!token || !hasCoords || !containerRef.current) return

    let mounted = true

    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default

      if (!mounted || !containerRef.current) return

      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/standard',
        center: [longitude!, latitude!],
        zoom: 16.5,
        pitch: 60,
        bearing: -17,
        config: {
          basemap: {
            lightPreset: 'day',
          },
        },
      })

      const marker = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([longitude!, latitude!])
        .addTo(map)

      mapRef.current = { map, marker }
    }

    init()
    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.marker.remove()
        mapRef.current.map.remove()
        mapRef.current = null
      }
    }
  }, [latitude, longitude, token, hasCoords])

  if (!hasCoords) {
    return (
      <div className={`rounded-[20px] bg-gray-800/50 border border-gray-700 flex items-center justify-center text-gray-400 text-sm ${className}`} style={{ minHeight: 200 }}>
        Location not available
      </div>
    )
  }

  if (!token) {
    return (
      <div className={`rounded-[20px] bg-gray-800/50 border border-gray-700 flex items-center justify-center text-gray-400 text-sm ${className}`} style={{ minHeight: 200 }}>
        Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to show map
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-[20px] overflow-hidden bg-gray-900 ${className}`}
      style={{ minHeight: 200 }}
    />
  )
}
