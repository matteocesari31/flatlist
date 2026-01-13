import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for geocoding results (persists for server lifetime)
const geocodeCache = new Map<string, { latitude: number; longitude: number; name: string } | null>()

// Optimize query for Nominatim - simplify verbose AI-generated location strings
function optimizeForNominatim(query: string): string {
  // Words to remove (but preserve campus names and location-specific terms)
  const stopWords = [
    'di', 'della', 'del', 'degli', 'delle', 'dei', 'dello',
    'station', 'stazione', 'metro', 'line', 'linea',
    'university', 'università', 'universita',
    'italy', 'italia', 'france', 'spain', 'germany', 'uk', 'usa'
  ]
  
  // Common campus/area names to preserve (these help Nominatim find specific locations)
  const campusIndicators = ['campus', 'sede', 'location', 'site']
  
  // Split into words
  const allWords = query.toLowerCase().split(/[\s,]+/).map(w => w.trim()).filter(w => w.length > 0)
  
  // Find campus name (word after "campus" or similar indicators)
  let campusName: string | null = null
  for (let i = 0; i < allWords.length; i++) {
    if (campusIndicators.includes(allWords[i]) && i + 1 < allWords.length) {
      campusName = allWords[i + 1]
      break
    }
  }
  
  // Filter words, but preserve campus names
  const words = allWords.filter(word => {
    const cleaned = word.trim()
    // Keep campus names and meaningful words
    return cleaned === campusName || (cleaned.length > 2 && !stopWords.includes(cleaned) && !campusIndicators.includes(cleaned))
  })
  
  // Reconstruct query - prioritize: location name + campus (if present) + city
  // For universities: try "UniversityName CampusName City" or "UniversityName City"
  if (words.some(w => w.includes('politecnico') || w.includes('bocconi') || w.includes('cattolica'))) {
    // Extract university name, campus name, and city
    const universityIndex = words.findIndex(w => w.includes('politecnico') || w.includes('bocconi') || w.includes('cattolica'))
    const cityIndex = words.findIndex(w => w === 'milan' || w === 'milano' || w === 'rome' || w === 'roma')
    const campusIndex = campusName ? words.findIndex(w => w === campusName) : -1
    
    if (universityIndex !== -1 && cityIndex !== -1) {
      const universityName = words[universityIndex]
      const city = words[cityIndex]
      
      // If we have a campus name, include it: "UniversityName CampusName City"
      if (campusIndex !== -1 && campusName) {
        return `${universityName} ${campusName} ${city}`
      }
      // Otherwise just "UniversityName City"
      return `${universityName} ${city}`
    }
  }
  
  // For metro stations: try "StationName City" or "Piazzale StationName City"
  if (words.some(w => w.includes('metro') || w.includes('m1') || w.includes('m2') || w.includes('m3') || w.includes('m4') || w.includes('m5'))) {
    const cityIndex = words.findIndex(w => w === 'milan' || w === 'milano' || w === 'rome' || w === 'roma')
    const stationName = words.filter(w => 
      w !== 'milan' && w !== 'milano' && w !== 'rome' && w !== 'roma' &&
      !w.includes('metro') && !w.includes('m1') && !w.includes('m2') && !w.includes('m3') && !w.includes('m4') && !w.includes('m5')
    ).join(' ')
    
    if (cityIndex !== -1 && stationName) {
      const city = words[cityIndex]
      return `${stationName} ${city}`
    }
  }
  
  // Default: keep location name + city, remove country and extra words
  const cityIndex = words.findIndex(w => 
    w === 'milan' || w === 'milano' || w === 'rome' || w === 'roma' || 
    w === 'paris' || w === 'london' || w === 'berlin' || w === 'madrid' ||
    w === 'barcelona' || w === 'amsterdam' || w === 'vienna'
  )
  
  if (cityIndex !== -1) {
    const city = words[cityIndex]
    const locationName = words.slice(0, cityIndex).join(' ')
    return locationName ? `${locationName} ${city}` : city
  }
  
  // Fallback: return cleaned query without stop words
  return words.join(' ')
}

// Normalize query for processing (remove accents, lowercase, simplify)
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ')    // Replace special chars with spaces
    .replace(/\s+/g, ' ')            // Normalize spaces
    .trim()
}

// Generate alternative query formats for Nominatim to improve success rate
function generateQueryVariations(query: string): string[] {
  const variations: string[] = [query]
  
  const normalized = normalizeQuery(query)
  const words = normalized.split(' ').filter(w => w.length > 0)
  
  // If it looks like a university with campus
  if (words.some(w => w.includes('politecnico') || w.includes('bocconi') || w.includes('cattolica'))) {
    const universityIndex = words.findIndex(w => w.includes('politecnico') || w.includes('bocconi') || w.includes('cattolica'))
    const cityIndex = words.findIndex(w => w === 'milan' || w === 'milano' || w === 'rome' || w === 'roma')
    
    if (universityIndex !== -1 && cityIndex !== -1) {
      const universityName = words[universityIndex]
      const city = words[cityIndex]
      const campusName = words.find((w, i) => i > universityIndex && i < cityIndex && w.length > 3)
      
      // Try different formats
      if (campusName) {
        variations.push(`${universityName} ${campusName} ${city}`)
        variations.push(`${universityName} campus ${campusName} ${city}`)
        variations.push(`${universityName} ${city} ${campusName}`)
      }
      variations.push(`${universityName} ${city}`)
      variations.push(`${universityName} di ${city}`)
    }
  }
  
  // If it looks like a metro station query, try different formats
  if (normalized.includes('metro') || normalized.includes('station') || normalized.includes('m1') || normalized.includes('m2') || normalized.includes('m3') || normalized.includes('m4') || normalized.includes('m5')) {
    // Extract potential station name
    const stationWords = words.filter(w => 
      !['metro', 'station', 'milan', 'milano', 'italy', 'italia', 'm1', 'm2', 'm3', 'm4', 'm5', 'line'].includes(w)
    )
    if (stationWords.length > 0) {
      const stationName = stationWords.join(' ')
      const cityIndex = words.findIndex(w => w === 'milan' || w === 'milano' || w === 'rome' || w === 'roma')
      const city = cityIndex !== -1 ? words[cityIndex] : 'Milano'
      
      // Try Piazzale/Piazza format (common for Milan metro stations)
      variations.push(`Piazzale ${stationName} ${city}`)
      variations.push(`Piazza ${stationName} ${city}`)
      variations.push(`${stationName} ${city} metro`)
      variations.push(`${stationName} ${city}`)
      variations.push(`Via ${stationName} ${city}`)
    }
  }
  
  // Try without metro/station/university words (but keep campus names)
  const simplified = normalized
    .replace(/\b(metro|station|university|universita|stazione)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (simplified !== normalized && simplified.length > 2) {
    const cityIndex = words.findIndex(w => w === 'milan' || w === 'milano' || w === 'rome' || w === 'roma')
    if (cityIndex !== -1) {
      const city = words[cityIndex]
      variations.push(`${simplified} ${city}`)
    }
  }
  
  return [...new Set(variations)] // Remove duplicates
}

async function tryGeocode(query: string): Promise<{ latitude: number; longitude: number; name: string } | null> {
  try {
    const encodedQuery = encodeURIComponent(query)
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'flatlist-app/1.0 (apartment search application)',
        'Accept-Language': 'en',
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return null
    }

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      name: data[0].display_name || query,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json(
      { error: 'Missing query parameter "q"' },
      { status: 400 }
    )
  }

  // Check cache first
  const cacheKey = query.toLowerCase().trim()
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    } else {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }
  }

  try {
    // First, optimize the query for Nominatim (simplify verbose AI-generated strings)
    const optimizedQuery = optimizeForNominatim(query)
    console.log(`Optimized geocoding query: "${query}" → "${optimizedQuery}"`)
    
    // Generate query variations and try each one with Nominatim
    // Start with the optimized query, then try variations
    const variations = [optimizedQuery, ...generateQueryVariations(optimizedQuery)]
    // Also try the original query as a fallback
    if (query !== optimizedQuery) {
      variations.push(query, ...generateQueryVariations(query))
    }
    
    for (const variation of variations) {
      const result = await tryGeocode(variation)
      if (result) {
        console.log(`Geocoded "${query}" using variation "${variation}": ${result.name}`)
        geocodeCache.set(cacheKey, result)
        return NextResponse.json(result)
      }
    }

    // No results found
    console.warn(`Could not geocode: "${query}" (tried ${variations.length} variations)`)
    geocodeCache.set(cacheKey, null)
    return NextResponse.json(
      { error: 'Location not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Geocoding error:', error)
    return NextResponse.json(
      { error: 'Geocoding failed' },
      { status: 500 }
    )
  }
}
