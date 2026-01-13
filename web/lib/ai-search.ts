// Convert natural language query to structured filters

export interface SearchFilters {
  noise_level?: 'low' | 'medium' | 'high'
  student_friendly?: boolean
  natural_light?: 'low' | 'medium' | 'high'
  floor_type?: 'wood' | 'tile' | 'unknown'
  renovation_state?: 'new' | 'ok' | 'old'
  price_max?: number
  price_min?: number
  size_sqm_min?: number
  rooms_min?: number
  bedrooms_min?: number
  bathrooms_min?: number
  location_keywords?: string[]
  // Distance-based filters
  distance_max?: number // Maximum distance in kilometers
  distance_reference?: string // Reference point name (e.g., "M2", "Bocconi", "M1 Duomo")
}

export async function parseSearchQuery(
  query: string,
  openaiApiKey: string
): Promise<{ filters: SearchFilters; explanation: string }> {
  const systemPrompt = `You are a search query parser for apartment listings worldwide. Convert natural language queries into structured filters.

Extract the following filters from the query:
- noise_level: "low", "medium", or "high" (for quiet/noisy mentions)
- student_friendly: true/false (for student mentions)
- natural_light: "low", "medium", or "high" (for light/bright/dark mentions)
- floor_type: "wood" or "tile" (for floor type mentions)
- renovation_state: "new", "ok", or "old" (for renovation mentions)
- price_max: maximum price in the local currency (for "under X€", "less than X€")
- price_min: minimum price in the local currency (for "over X€", "more than X€")
- size_sqm_min: minimum size in square meters
- rooms_min: minimum number of rooms (total rooms including living room, kitchen, etc.)
- bedrooms_min: minimum number of bedrooms (sleeping rooms only)
- bathrooms_min: minimum number of bathrooms
- location_keywords: array of location keywords (neighborhoods, areas) - ONLY use this for neighborhood/area names, NOT for metro lines, stations, landmarks, or universities
- distance_max: maximum distance in kilometers. If the query says "near" or "close to" without specifying a distance, use 1.5 as the default. If it says "within X km" or "less than X km", use that number.
- distance_reference: The FULL geocodable location string including city/country context so it can be looked up on a map. This must be detailed enough for a geocoding API to find. Examples:
  * "M4 metro station Milan Italy" (for metro lines/stations)
  * "Bocconi University Milan Italy" (for universities)
  * "Central Station Paris France" (for train stations)
  * "Times Square New York USA" (for landmarks)
  * "Brandenburg Gate Berlin Germany" (for landmarks)
  Always include the city and country if mentioned or inferrable from context.

Return ONLY valid JSON in this format:
{
  "filters": {
    "noise_level": "low",
    "student_friendly": true,
    "price_max": 900,
    "distance_max": 1.5,
    "distance_reference": "M2 metro station Milan Italy"
  },
  "explanation": "Quiet apartments for students under 900€ within 1.5km from M2"
}

CRITICAL RULES:
- If query says "near [location]" or "close to [location]" without a distance, set distance_max to 1.5 and distance_reference to the full geocodable location string
- Metro lines, stations, universities, landmarks should ALWAYS be extracted as distance_reference with full context, NOT as location_keywords
- Extract ALL mentioned filters - don't skip any that are clearly mentioned in the query
- Always include city/country context in distance_reference for accurate geocoding

If a filter is not mentioned, omit it from the filters object.`

  const userPrompt = `Parse this search query: "${query}"`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      throw new Error('OpenAI API error')
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const parsed = JSON.parse(content)
    return {
      filters: parsed.filters || {},
      explanation: parsed.explanation || query
    }
  } catch (error) {
    console.error('Error parsing search query:', error)
    // Fallback: return empty filters
    return {
      filters: {},
      explanation: query
    }
  }
}

// Generate explanation from matched filters (client-side)
export function generateExplanation(filters: SearchFilters, matchedCount: number): string {
  const parts: string[] = []

  if (filters.noise_level) {
    parts.push(`noise level: ${filters.noise_level}`)
  }
  if (filters.student_friendly === true) {
    parts.push('student-friendly')
  }
  if (filters.natural_light) {
    parts.push(`natural light: ${filters.natural_light}`)
  }
  if (filters.floor_type) {
    parts.push(`${filters.floor_type} floors`)
  }
  if (filters.price_max) {
    parts.push(`under €${filters.price_max}`)
  }
  if (filters.price_min) {
    parts.push(`over €${filters.price_min}`)
  }
  if (filters.rooms_min) {
    parts.push(`${filters.rooms_min}+ rooms`)
  }
  if (filters.bedrooms_min) {
    parts.push(`${filters.bedrooms_min}+ bedrooms`)
  }
  if (filters.bathrooms_min) {
    parts.push(`${filters.bathrooms_min}+ bathrooms`)
  }
  if (filters.location_keywords && filters.location_keywords.length > 0) {
    parts.push(`near ${filters.location_keywords.join(', ')}`)
  }
  if (filters.distance_max && filters.distance_reference) {
    parts.push(`within ${filters.distance_max}km from ${filters.distance_reference}`)
  }

  if (parts.length === 0) {
    return `Found ${matchedCount} listing${matchedCount !== 1 ? 's' : ''}`
  }

  return `Matches: ${parts.join(', ')} (${matchedCount} result${matchedCount !== 1 ? 's' : ''})`
}

