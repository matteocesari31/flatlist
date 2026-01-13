// Geocoding utilities for distance calculations
// Uses dynamic geocoding via OpenStreetMap Nominatim for worldwide support

export interface Point {
  name: string
  latitude: number
  longitude: number
}

// In-memory cache for geocoding results (client-side)
const geocodeCache = new Map<string, Point | null>()

// Haversine formula to calculate distance between two points in kilometers
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  
  return distance
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

// Find reference point by geocoding the query dynamically
// This works for any location worldwide (metro stations, universities, landmarks, etc.)
export async function findReferencePoint(query: string): Promise<Point | null> {
  if (!query || query.trim() === '') {
    return null
  }

  const cacheKey = query.toLowerCase().trim()
  
  // Check client-side cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null
  }

  try {
    // Call our geocoding API route
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
    
    if (!response.ok) {
      console.warn(`Geocoding failed for "${query}":`, response.status)
      geocodeCache.set(cacheKey, null)
      return null
    }

    const data = await response.json()
    
    if (data.latitude && data.longitude) {
      const point: Point = {
        name: data.name || query,
        latitude: data.latitude,
        longitude: data.longitude,
      }
      geocodeCache.set(cacheKey, point)
      return point
    }

    geocodeCache.set(cacheKey, null)
    return null
  } catch (error) {
    console.error('Geocoding error:', error)
    geocodeCache.set(cacheKey, null)
    return null
  }
}

// Filter listings by distance from a reference point
export function filterByDistance(
  listings: Array<{ listing_metadata?: Array<{ latitude?: number; longitude?: number; address?: string }> }>,
  referencePoint: Point,
  maxDistanceKm: number
): Array<{ listing: any; distance: number }> {
  console.log(`🔍 Filtering ${listings.length} listings by distance (max ${maxDistanceKm}km from ${referencePoint.name})`)
  
  const results = listings
    .map(listing => {
      const metadata = listing.listing_metadata?.[0]
      const address = metadata?.address || 'Unknown address'
      
      if (!metadata?.latitude || !metadata?.longitude) {
        console.log(`⚠️ Skipping "${address}" - no coordinates (lat: ${metadata?.latitude}, lng: ${metadata?.longitude})`)
        return null // Skip listings without coordinates
      }
      
      const distance = calculateDistance(
        referencePoint.latitude,
        referencePoint.longitude,
        metadata.latitude,
        metadata.longitude
      )
      
      if (distance <= maxDistanceKm) {
        console.log(`✅ Including "${address}" - ${distance.toFixed(2)}km away`)
        return { listing, distance }
      }
      
      console.log(`❌ Excluding "${address}" - ${distance.toFixed(2)}km away (> ${maxDistanceKm}km)`)
      return null
    })
    .filter((item): item is { listing: any; distance: number } => item !== null)
    .sort((a, b) => a.distance - b.distance) // Sort by distance (closest first)
  
  console.log(`📊 Distance filter result: ${results.length}/${listings.length} listings within range`)
  return results
}
