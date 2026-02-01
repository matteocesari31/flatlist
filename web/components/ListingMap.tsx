'use client'

import { useEffect, useRef } from 'react'

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

interface ListingMapProps {
  latitude: number
  longitude: number
  className?: string
}

export default function ListingMap({ latitude, longitude, className = '' }: ListingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ map: import('mapbox-gl').Map; marker: import('mapbox-gl').Marker } | null>(null)

  useEffect(() => {
    if (!MAPBOX_ACCESS_TOKEN || !containerRef.current) return

    let mounted = true

    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      await import('mapbox-gl/dist/mapbox-gl.css')

      if (!mounted || !containerRef.current) return

      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/standard',
        center: [longitude, latitude],
        zoom: 15,
        pitch: 60,
        bearing: -17,
      })

      const marker = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([longitude, latitude])
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
  }, [latitude, longitude])

  if (!MAPBOX_ACCESS_TOKEN) {
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
