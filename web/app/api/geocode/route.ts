import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for geocoding results (persists for server lifetime)
const geocodeCache = new Map<string, { latitude: number; longitude: number; name: string } | null>()

// Optimize query for Nominatim - simplify verbose AI-generated location strings
// Now handles international addresses (US, UK, Italy, etc.)
function optimizeForNominatim(query: string): string {
  // Detect country from query
  const upper = query.toUpperCase()
  const isUS = /\b\d{5}(-\d{4})?\b/.test(query) || /\b(CA|NY|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|IA|UT|AR|NV|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|DC|VT|WY)\b/.test(upper) || upper.includes('USA') || upper.includes('UNITED STATES')
  const isUK = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i.test(query) || upper.includes('UK') || upper.includes('UNITED KINGDOM')
  const isIT = /\b(Via|Viale|Piazza|Piazzale|Corso|Vicolo|Largo)\b/i.test(query) || upper.includes('ITALIA') || upper.includes('ITALY') || /\b(Milano|Roma|Firenze|Torino|Napoli|Bologna|Genova|Palermo|Venezia)\b/i.test(query)
  
  // For US addresses, keep the structure as-is (street, city, state, ZIP)
  if (isUS) {
    // Remove apartment/unit numbers for better geocoding
    return query.replace(/\s*#\s*[A-Z0-9]+\s*/gi, ' ').replace(/\s*(Apt|Apartment|Unit|Suite|Ste|#)\s*[A-Z0-9]+\s*/gi, ' ').trim()
  }
  
  // For UK addresses, preserve postcode and structure
  if (isUK) {
    return query.trim()
  }
  
  // For Italian addresses, use the original logic
  if (isIT) {
    // Words to remove (but preserve campus names and location-specific terms)
    const stopWords = [
      'di', 'della', 'del', 'degli', 'delle', 'dei', 'dello',
      'station', 'stazione', 'metro', 'line', 'linea',
      'university', 'università', 'universita',
      'italy', 'italia'
    ]
    
    // Common campus/area names to preserve
    const campusIndicators = ['campus', 'sede', 'location', 'site']
    
    // Split into words
    const allWords = query.toLowerCase().split(/[\s,]+/).map(w => w.trim()).filter(w => w.length > 0)
    
    // Find campus name
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
      return cleaned === campusName || (cleaned.length > 2 && !stopWords.includes(cleaned) && !campusIndicators.includes(cleaned))
    })
    
    // For Italian universities
    if (words.some(w => w.includes('politecnico') || w.includes('bocconi') || w.includes('cattolica'))) {
      const universityIndex = words.findIndex(w => w.includes('politecnico') || w.includes('bocconi') || w.includes('cattolica'))
      const cityIndex = words.findIndex(w => w === 'milan' || w === 'milano' || w === 'rome' || w === 'roma')
      const campusIndex = campusName ? words.findIndex(w => w === campusName) : -1
      
      if (universityIndex !== -1 && cityIndex !== -1) {
        const universityName = words[universityIndex]
        const city = words[cityIndex]
        
        if (campusIndex !== -1 && campusName) {
          return `${universityName} ${campusName} ${city}`
        }
        return `${universityName} ${city}`
      }
    }
    
    // For metro stations
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
    
    // Default: keep location name + city
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
    
    return words.join(' ')
  }
  
  // For other countries, return as-is (let Nominatim handle it)
  return query.trim()
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
// Now handles international addresses
function generateQueryVariations(query: string): string[] {
  const variations: string[] = [query]
  
  // Detect country
  const upper = query.toUpperCase()
  const isUS = /\b\d{5}(-\d{4})?\b/.test(query) || /\b(CA|NY|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|IA|UT|AR|NV|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|DC|VT|WY)\b/.test(upper) || upper.includes('USA') || upper.includes('UNITED STATES')
  const isUK = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i.test(query) || upper.includes('UK') || upper.includes('UNITED KINGDOM')
  const isIT = /\b(Via|Viale|Piazza|Piazzale|Corso|Vicolo|Largo)\b/i.test(query) || upper.includes('ITALIA') || upper.includes('ITALY') || /\b(Milano|Roma|Firenze|Torino|Napoli|Bologna|Genova|Palermo|Venezia)\b/i.test(query)
  
  if (isUS) {
    // US address variations
    // Try parsing "Street, City, State ZIP"
    const usMatch = query.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(-\d{4})?)$/i)
    if (usMatch) {
      const [, street, city, state, zip] = usMatch
      variations.push(`${street}, ${city}, ${state} ${zip}`)
      variations.push(`${street}, ${city}, ${state}`)
      variations.push(`${city}, ${state} ${zip}`)
      variations.push(`${city}, ${state}`)
    } else {
      // Try without ZIP
      const usMatchNoZip = query.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})$/i)
      if (usMatchNoZip) {
        const [, street, city, state] = usMatchNoZip
        variations.push(`${street}, ${city}, ${state}`)
        variations.push(`${city}, ${state}`)
      }
    }
    
    // Add country if not present
    if (!upper.includes('USA') && !upper.includes('UNITED STATES')) {
      variations.push(`${query}, USA`)
    }
  } else if (isUK) {
    // UK address variations
    const postcodeMatch = query.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i)
    if (postcodeMatch) {
      const postcode = postcodeMatch[1]
      variations.push(postcode)
      const cityMatch = query.match(/^(.+?),\s*(.+?)(?:,\s*[^,]+)?,\s*[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/i)
      if (cityMatch) {
        variations.push(`${cityMatch[2]}, ${postcode}`)
      }
    }
    
    // Add country if not present
    if (!upper.includes('UK') && !upper.includes('UNITED KINGDOM')) {
      variations.push(`${query}, UK`)
    }
  } else if (isIT) {
    // Italian address variations (original logic)
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
        
        if (campusName) {
          variations.push(`${universityName} ${campusName} ${city}`)
          variations.push(`${universityName} campus ${campusName} ${city}`)
          variations.push(`${universityName} ${city} ${campusName}`)
        }
        variations.push(`${universityName} ${city}`)
        variations.push(`${universityName} di ${city}`)
      }
    }
    
    // If it looks like a metro station query
    if (normalized.includes('metro') || normalized.includes('station') || normalized.includes('m1') || normalized.includes('m2') || normalized.includes('m3') || normalized.includes('m4') || normalized.includes('m5')) {
      const stationWords = words.filter(w => 
        !['metro', 'station', 'milan', 'milano', 'italy', 'italia', 'm1', 'm2', 'm3', 'm4', 'm5', 'line'].includes(w)
      )
      if (stationWords.length > 0) {
        const stationName = stationWords.join(' ')
        const cityIndex = words.findIndex(w => w === 'milan' || w === 'milano' || w === 'rome' || w === 'roma')
        const city = cityIndex !== -1 ? words[cityIndex] : 'Milano'
        
        variations.push(`Piazzale ${stationName} ${city}`)
        variations.push(`Piazza ${stationName} ${city}`)
        variations.push(`${stationName} ${city} metro`)
        variations.push(`${stationName} ${city}`)
        variations.push(`Via ${stationName} ${city}`)
      }
    }
    
    // Try without metro/station/university words
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
    
    // Add country if not present
    if (!query.includes('Italy') && !query.includes('Italia')) {
      variations.push(`${query}, Italy`)
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
