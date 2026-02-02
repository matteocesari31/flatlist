import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Truncate content to max length, preserving top, middle, and bottom
function truncateContent(content: string, maxLength: number = 15000): string {
  if (content.length <= maxLength) {
    return content
  }

  const sliceLength = Math.floor(maxLength / 3)
  const top = content.slice(0, sliceLength)
  const bottom = content.slice(-sliceLength)
  const middleStart = Math.floor((content.length - sliceLength) / 2)
  const middle = content.slice(middleStart, middleStart + sliceLength)

  return `${top}\n\n[... middle section ...]\n\n${middle}\n\n[... middle section ...]\n\n${bottom}`
}

serve(async (req) => {
  // Log ALL requests immediately
  console.log('=== ENRICH-LISTING REQUEST RECEIVED ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2))

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Parse body early so we can use it in error handler
  let requestBody: { listing_id?: string } = {}
  let listingId: string | null = null
  
  try {
    requestBody = await req.json()
    listingId = requestBody.listing_id || null
  } catch (parseError) {
    console.error('Failed to parse request body:', parseError)
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Helper function to update status safely
  const updateStatus = async (status: 'processing' | 'done' | 'failed', listingIdToUpdate: string) => {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Cannot update status: missing env vars')
        return
      }
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { error } = await supabase
        .from('listings')
        .update({ enrichment_status: status })
        .eq('id', listingIdToUpdate)
      if (error) {
        console.error('Error updating status:', error)
      } else {
        console.log(`Status updated to ${status} for listing ${listingIdToUpdate}`)
      }
    } catch (err) {
      console.error('Exception updating status:', err)
    }
  }

  try {
    // Get authorization (should be service role key)
    const authHeader = req.headers.get('Authorization')
    console.log('Authorization header present:', !!authHeader)
    if (!authHeader) {
      console.error('Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('SUPABASE_URL set:', !!supabaseUrl)
    console.log('SUPABASE_SERVICE_ROLE_KEY set:', !!supabaseServiceKey)
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey
      })
      return new Response(
        JSON.stringify({ error: 'Server configuration error', details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    })
    
    console.log('Supabase client created with service role key (RLS bypassed)')

    // Use already parsed body
    const listing_id = listingId
    
    console.log('Listing ID received:', listing_id)

    if (!listing_id) {
      return new Response(
        JSON.stringify({ error: 'Missing listing_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update status to processing
    console.log('Updating status to processing for listing:', listing_id)
    await updateStatus('processing', listing_id)

    // Fetch listing
    console.log('Fetching listing content...')
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('raw_content, images')
      .eq('id', listing_id)
      .single()

    if (fetchError || !listing) {
      console.error('Error fetching listing:', fetchError)
      await updateStatus('failed', listing_id)
      return new Response(
        JSON.stringify({ error: 'Listing not found', details: fetchError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Listing fetched, content length:', listing.raw_content?.length || 0)

    // Truncate content to smaller size for faster processing (reduced from 15k to 8k)
    const truncatedContent = truncateContent(listing.raw_content, 8000)
    console.log('Content length:', truncatedContent.length)
    console.log('Images available:', listing.images?.length || 0)

    // Call OpenAI API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not set')
    }

    // Prepare messages for OpenAI
    const messages: any[] = [
      {
        role: 'system',
        content: `You are an expert at analyzing apartment listings from any country. Extract structured metadata from the listing content and images.

Extract the following information:
- Hard facts: price (numeric), address, size_sqm (numeric - ALWAYS convert to square meters if the listing uses square feet), rooms (integer), bedrooms (integer - number of bedrooms/sleeping rooms), bathrooms (integer - number of bathrooms), beds_single (integer), beds_double (integer), furnishing (text), condo_fees (numeric, optional - monthly condominio/condo fees if mentioned), listing_type ("rent" or "sale" - determine from keywords like "affitto"/"rent" for rent, "vendita"/"sale" for sale), currency (string - currency code like "EUR", "USD", "GBP", "CHF", "CAD", "AUD" based on the price format in the listing), size_unit (string - "sqm" if listing uses square meters/m², "sqft" if listing uses square feet/ft²/sq ft)
- Inferred attributes:
  * student_friendly (boolean): ALWAYS DEFAULT TO TRUE. Only set to false if the listing contains an EXPLICIT statement like "no students", "students not allowed", "no studenti", "studenti non ammessi", or similar direct rejection of student tenants. High price, luxury, prestigious, or professional target audience does NOT mean students are not allowed. If there is no explicit "no students" statement, student_friendly MUST be true.
  * floor_type ("wood", "tile", or "unknown"): Infer from text descriptions or visible flooring in images
  * natural_light ("low", "medium", or "high"): Infer from BOTH text descriptions (e.g., "large windows", "bright", "basement") AND image analysis (brightness, window size, amount of sunlight visible). If images are provided, prioritize visual assessment of light quality.
  * noise_level ("low", "medium", or "high"): Infer from text descriptions (e.g., "quiet area", "main street", "courtyard")
  * renovation_state ("new", "ok", or "old"): Infer from text or visible condition in images
  * pet_friendly (boolean): Set to true if the listing explicitly mentions pets are allowed (e.g., "pet friendly", "animali ammessi", "consentiti animali"). Set to false if explicitly stated pets are not allowed. If not mentioned, set to null.
  * balcony (boolean): Set to true if the listing mentions a balcony, terrace, or similar outdoor space (e.g., "balcone", "terrazzo", "balcony", "terrace"). Set to false if explicitly stated there is no balcony. If not mentioned, set to null.
- Vibe tags: array of descriptive tags like "modern", "cozy", "minimal", etc.
- Evidence: for each inferred attribute, provide a short text snippet from the listing OR description of what you see in images that supports the inference

Return ONLY valid JSON in this exact format:
{
  "price": 850.00,
  "address": "Via Example 123, Milan",
  "size_sqm": 45,
  "rooms": 2,
  "bedrooms": 1,
  "bathrooms": 1,
  "beds_single": 0,
  "beds_double": 1,
  "furnishing": "Furnished",
  "condo_fees": 150.00,
  "listing_type": "rent",
  "currency": "EUR",
  "size_unit": "sqm",
  "student_friendly": true,
  "floor_type": "wood",
  "natural_light": "high",
  "noise_level": "low",
  "renovation_state": "ok",
  "pet_friendly": true,
  "balcony": true,
  "vibe_tags": ["modern", "bright"],
  "evidence": {
    "student_friendly": "No explicit 'no students' statement found - defaulting to true",
    "floor_type": "Parquet flooring throughout",
    "natural_light": "Large windows facing south",
    "noise_level": "Internal courtyard, quiet area",
    "renovation_state": "Recently renovated bathroom",
    "pet_friendly": "Listing mentions 'animali ammessi'",
    "balcony": "Listing mentions 'balcone'"
  }
}

IMPORTANT NOTES:
- For currency: Detect from price format - € = EUR, $ = USD (or CAD/AUD based on address), £ = GBP, CHF = CHF
- For size_unit: If listing shows "sq ft", "ft²", "square feet", "sqft" → use "sqft". If listing shows "m²", "sqm", "square meters", "square metres" → use "sqm"
- ALWAYS convert size to square meters in size_sqm field (multiply sqft by 0.092903 to get sqm)
- If size_unit is "sqft", store the original square feet value converted to sqm in size_sqm, but keep size_unit as "sqft" so the UI can display correctly`
      }
    ]

    // Build user message with text and optionally images
    const userMessageContent: any[] = [
      {
        type: 'text',
        text: `Analyze this Italian apartment listing:\n\n${truncatedContent}`
      }
    ]

    // Add images if available (using Vision API)
    if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
      console.log('Adding images to analysis:', listing.images.length)
      for (const imageUrl of listing.images.slice(0, 2)) { // Max 2 images
        try {
          // Fetch image and convert to base64
          const imageResponse = await fetch(imageUrl)
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer()
            const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))
            const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'
            userMessageContent.push({
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            })
          }
        } catch (imgError) {
          console.warn('Failed to fetch image:', imageUrl, imgError)
          // Continue without this image
        }
      }
    }

    messages.push({
      role: 'user',
      content: userMessageContent
    })

    console.log('Calling OpenAI API...', {
      hasImages: userMessageContent.some(c => c.type === 'image_url'),
      imageCount: userMessageContent.filter(c => c.type === 'image_url').length
    })
    const startTime = Date.now()
    
    // Add timeout to OpenAI request (30 seconds max)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    let openaiResponse
    try {
      // Use gpt-4o or gpt-4-turbo for vision, fallback to gpt-3.5-turbo if no images
      const model = userMessageContent.some(c => c.type === 'image_url') 
        ? 'gpt-4o' // Vision-capable model
        : 'gpt-3.5-turbo'
      
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 500 // Limit response size for faster processing
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const elapsed = Date.now() - startTime
      console.log(`OpenAI API call took ${elapsed}ms`)

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.text()
        console.error('OpenAI API error:', errorData)
        await supabase
          .from('listings')
          .update({ enrichment_status: 'failed' })
          .eq('id', listing_id)
        
        return new Response(
          JSON.stringify({ error: 'OpenAI API error', details: errorData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.error('OpenAI API timeout after 30 seconds')
        await supabase
          .from('listings')
          .update({ enrichment_status: 'failed' })
          .eq('id', listing_id)
        
        return new Response(
          JSON.stringify({ error: 'OpenAI API timeout', details: 'Request took longer than 30 seconds' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw fetchError
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices[0]?.message?.content

    if (!content) {
      console.error('No content in OpenAI response')
      await updateStatus('failed', listing_id)
      throw new Error('No content in OpenAI response')
    }

    // Parse JSON response
    let metadata
    try {
      metadata = JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      await supabase
        .from('listings')
        .update({ enrichment_status: 'failed' })
        .eq('id', listing_id)
      
      return new Response(
        JSON.stringify({ error: 'Invalid JSON from OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upsert metadata
    console.log('Saving metadata to database...')
    console.log('Metadata to save:', {
      listing_id,
      price: metadata.price,
      address: metadata.address,
      size_sqm: metadata.size_sqm,
      rooms: metadata.rooms,
      hasVibeTags: !!metadata.vibe_tags,
      vibeTagsCount: metadata.vibe_tags?.length || 0
    })
    
    // First, verify the listing exists and get user_id for logging
    const { data: listingData, error: listingCheckError } = await supabase
      .from('listings')
      .select('id, user_id')
      .eq('id', listing_id)
      .single()
    
    if (listingCheckError || !listingData) {
      console.error('❌ Listing not found:', listingCheckError)
      await updateStatus('failed', listing_id)
      return new Response(
        JSON.stringify({ error: 'Listing not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Listing found, user_id:', listingData.user_id)
    
    // Geocode address if available (using OpenStreetMap Nominatim - free, no API key needed)
    let latitude: number | null = null
    let longitude: number | null = null
    
    if (metadata.address) {
      try {
        console.log('Geocoding address:', metadata.address)
        
        // Helper function to try geocoding with a query
        const tryGeocode = async (query: string): Promise<{ lat: number; lon: number } | null> => {
          const encodedAddress = encodeURIComponent(query)
          const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`
          
          const geocodeResponse = await fetch(geocodeUrl, {
            headers: {
              'User-Agent': 'flatlist-apartment-assistant/1.0',
              'Accept-Language': 'en'
            }
          })
          
          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json()
            if (geocodeData && geocodeData.length > 0) {
              return {
                lat: parseFloat(geocodeData[0].lat),
                lon: parseFloat(geocodeData[0].lon)
              }
            }
          }
          return null
        }
        
        // Detect country and address format from the address string
        const detectCountry = (addr: string): 'US' | 'UK' | 'IT' | 'OTHER' => {
          const upper = addr.toUpperCase()
          // US: ZIP codes (5 digits), state abbreviations (CA, NY, TX, etc.), or "USA"/"United States"
          if (/\b\d{5}(-\d{4})?\b/.test(addr) || /\b(CA|NY|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|IA|UT|AR|NV|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|DC|VT|WY)\b/.test(upper) || upper.includes('USA') || upper.includes('UNITED STATES')) {
            return 'US'
          }
          // UK: Postcodes (e.g., SW1A 1AA, M1 1AA, etc.)
          if (/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i.test(addr) || upper.includes('UK') || upper.includes('UNITED KINGDOM') || upper.includes('ENGLAND') || upper.includes('SCOTLAND') || upper.includes('WALES')) {
            return 'UK'
          }
          // Italy: Italian street types, city names, or "Italia"/"Italy"
          if (/\b(Via|Viale|Piazza|Piazzale|Corso|Vicolo|Largo|Via|Viale)\b/i.test(addr) || upper.includes('ITALIA') || upper.includes('ITALY') || /\b(Milano|Roma|Firenze|Torino|Napoli|Bologna|Genova|Palermo|Venezia)\b/i.test(addr)) {
            return 'IT'
          }
          return 'OTHER'
        }
        
        // Generate query variations based on detected country
        const generateQueryVariations = (addr: string, country: 'US' | 'UK' | 'IT' | 'OTHER'): string[] => {
          const variations: string[] = []
          
          if (country === 'US') {
            // US address format: "Street Number Street Name, City, State ZIP" or "Street Name, City, State"
            // Try full address first
            variations.push(addr)
            
            // Remove apartment/unit numbers (e.g., "#3BDDOWN", "Apt 5", "Unit 2")
            const cleaned = addr.replace(/\s*#\s*[A-Z0-9]+\s*/gi, ' ').replace(/\s*(Apt|Apartment|Unit|Suite|Ste|#)\s*[A-Z0-9]+\s*/gi, ' ').trim()
            if (cleaned !== addr) {
              variations.push(cleaned)
            }
            
            // Extract components: try to parse "Street, City, State ZIP"
            const usMatch = addr.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(-\d{4})?)$/i)
            if (usMatch) {
              const [, street, city, state, zip] = usMatch
              variations.push(`${street}, ${city}, ${state} ${zip}`)
              variations.push(`${street}, ${city}, ${state}`)
              variations.push(`${city}, ${state} ${zip}`)
              variations.push(`${city}, ${state}`)
            } else {
              // Try without ZIP
              const usMatchNoZip = addr.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})$/i)
              if (usMatchNoZip) {
                const [, street, city, state] = usMatchNoZip
                variations.push(`${street}, ${city}, ${state}`)
                variations.push(`${city}, ${state}`)
              }
            }
            
            // Add country if not present
            if (!addr.toUpperCase().includes('USA') && !addr.toUpperCase().includes('UNITED STATES')) {
              variations.push(`${addr}, USA`)
            }
          } else if (country === 'UK') {
            // UK address format: "Street, City, Postcode" or "Street, City, County, Postcode"
            variations.push(addr)
            
            // Extract postcode if present
            const postcodeMatch = addr.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i)
            if (postcodeMatch) {
              const postcode = postcodeMatch[1]
              // Try with just postcode
              variations.push(postcode)
              // Try with city and postcode
              const cityMatch = addr.match(/^(.+?),\s*(.+?)(?:,\s*[^,]+)?,\s*[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/i)
              if (cityMatch) {
                variations.push(`${cityMatch[2]}, ${postcode}`)
              }
            }
            
            // Add country if not present
            if (!addr.toUpperCase().includes('UK') && !addr.toUpperCase().includes('UNITED KINGDOM')) {
              variations.push(`${addr}, UK`)
            }
          } else if (country === 'IT') {
            // Italian address format: "Via Street Name Number, Neighborhood, City"
            variations.push(addr)
            
            // Extract components: street type, street name, number, neighborhood, city
            const itMatch = addr.match(/^((?:Via|Viale|Piazza|Piazzale|Corso|Vicolo|Largo)\s+)(.+?)(\s+\d+)?(?:\s*,\s*([^,]+))?(?:\s*,\s*(Milano|Roma|Firenze|Torino|Napoli|Bologna|Genova|Palermo|Venezia))?/i)
            
            if (itMatch) {
              const [, streetType, streetName, number, neighborhood, city] = itMatch
              const streetTypeClean = streetType.trim()
              const streetNameClean = streetName.trim()
              const numberClean = number ? number.trim() : ''
              const neighborhoodClean = neighborhood ? neighborhood.trim() : null
              const cityClean = city ? city.trim() : null
              
              // Try variations with different word orders in street name (for cases like "da Fossano Bergognone" vs "Bergognone da Fossano")
              const streetWords = streetNameClean.split(/\s+/)
              if (streetWords.length > 2) {
                // Try reversed order for multi-word street names
                const reversedStreet = streetWords.reverse().join(' ')
                variations.push(`${streetTypeClean}${reversedStreet}${numberClean}${cityClean ? `, ${cityClean}` : ''}`)
                variations.push(`${streetTypeClean}${reversedStreet}${numberClean}${cityClean ? `, ${cityClean}, Italy` : ', Italy'}`)
              }
              
              // Try without neighborhood
              if (neighborhoodClean) {
                const withoutNeighborhood = `${streetTypeClean}${streetNameClean}${numberClean}${cityClean ? `, ${cityClean}` : ''}`
                if (!variations.includes(withoutNeighborhood)) {
                  variations.push(withoutNeighborhood)
                }
                variations.push(`${withoutNeighborhood}, Italy`)
              }
              
              // Try with just street name + city (no number)
              if (cityClean) {
                variations.push(`${streetTypeClean}${streetNameClean}, ${cityClean}`)
                variations.push(`${streetTypeClean}${streetNameClean}, ${cityClean}, Italy`)
              }
              
              // Try neighborhood + city + number as fallback
              if (neighborhoodClean && cityClean && numberClean) {
                variations.push(`${neighborhoodClean}, ${cityClean}${numberClean}`)
                variations.push(`${neighborhoodClean}, ${cityClean}, Italy`)
              }
            } else {
              // Fallback: try to extract street part
              const streetMatch = addr.match(/^((?:Via|Viale|Piazza|Piazzale|Corso|Vicolo|Largo)\s+[^,]+)/i)
              const streetOnly = streetMatch ? streetMatch[1].trim() : null
              
              // Remove neighborhood info
              const cleanedAddress = addr
                .replace(/,\s*[A-Za-z\s-]+\s*-\s*[A-Za-z\s-]+\s*,/g, ',')
                .replace(/,\s*[A-Za-z\s-]+\s*,\s*(Milano|Roma|Firenze|Torino|Napoli)/gi, ', $1')
              
              if (cleanedAddress !== addr) {
                variations.push(cleanedAddress)
              }
              
              if (streetOnly) {
                // Extract city
                const cityMatch = addr.match(/\b(Milano|Roma|Firenze|Torino|Napoli|Bologna|Genova|Palermo|Venezia)\b/i)
                if (cityMatch) {
                  const city = cityMatch[1]
                  variations.push(`${streetOnly}, ${city}`)
                  variations.push(`${streetOnly}, ${city}, Italy`)
                }
              }
            }
            
            // Add country if not present
            if (!addr.includes('Italy') && !addr.includes('Italia')) {
              variations.push(`${addr}, Italy`)
            }
          } else {
            // For other countries, try the address as-is and with common country names
            variations.push(addr)
            // Don't add country names for unknown countries - let Nominatim figure it out
          }
          
          return [...new Set(variations)] // Remove duplicates
        }
        
        // Detect country and generate variations
        const address = metadata.address
        const country = detectCountry(address)
        console.log(`Detected country: ${country} for address: ${address}`)
        
        const queryVariations = generateQueryVariations(address, country)
        console.log(`Generated ${queryVariations.length} query variations`)
        
        // Try each variation
        for (const query of queryVariations) {
          console.log(`Trying geocode query: "${query}"`)
          const result = await tryGeocode(query)
          
          if (result) {
            latitude = result.lat
            longitude = result.lon
            console.log(`✅ Geocoded successfully with query "${query}":`, { latitude, longitude })
            break
          }
          
          // Small delay between requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        if (!latitude || !longitude) {
          console.log('⚠️ Could not geocode address after trying all variations:', metadata.address)
        }
      } catch (geocodeError) {
        console.warn('Geocoding failed (non-critical):', geocodeError)
        // Continue without coordinates - not a critical error
      }
    }

    // Upsert metadata (service role key bypasses RLS)
    console.log('Attempting to upsert metadata...')
    const { data: savedMetadata, error: metadataError } = await supabase
      .from('listing_metadata')
      .upsert({
        listing_id,
        price: metadata.price || null,
        address: metadata.address || null,
        latitude: latitude,
        longitude: longitude,
        size_sqm: metadata.size_sqm || null,
        rooms: metadata.rooms || null,
        bedrooms: metadata.bedrooms || null,
        bathrooms: metadata.bathrooms || null,
        beds_single: metadata.beds_single || null,
        beds_double: metadata.beds_double || null,
        furnishing: metadata.furnishing || null,
        condo_fees: metadata.condo_fees || null,
        currency: (metadata as any).currency || null,
        size_unit: (metadata as any).size_unit || 'sqm',
        student_friendly: metadata.student_friendly ?? null,
        floor_type: metadata.floor_type || 'unknown',
        natural_light: metadata.natural_light || 'medium',
        noise_level: metadata.noise_level || 'medium',
        renovation_state: metadata.renovation_state || 'ok',
        pet_friendly: (metadata as any).pet_friendly ?? null,
        balcony: (metadata as any).balcony ?? null,
        listing_type: (metadata as any).listing_type || null,
        vibe_tags: metadata.vibe_tags || [],
        evidence: metadata.evidence || {}
      }, {
        onConflict: 'listing_id'
      })
      .select()

    if (metadataError) {
      console.error('❌ Error saving metadata:', metadataError)
      console.error('Error details:', {
        message: metadataError.message,
        code: metadataError.code,
        details: metadataError.details,
        hint: metadataError.hint,
        listing_id: listing_id,
        user_id: listingData.user_id
      })
      await updateStatus('failed', listing_id)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save metadata', 
          details: metadataError.message,
          code: metadataError.code,
          hint: metadataError.hint
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!savedMetadata || savedMetadata.length === 0) {
      console.error('❌ Metadata upsert returned no data (but no error)')
      await updateStatus('failed', listing_id)
      return new Response(
        JSON.stringify({ error: 'Metadata upsert returned no data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Metadata saved successfully:', {
      metadataId: savedMetadata[0]?.id,
      listingId: listing_id,
      price: savedMetadata[0]?.price,
      address: savedMetadata[0]?.address
    })

    // Update status to done
    console.log('Updating status to done...')
    await updateStatus('done', listing_id)
    console.log('Enrichment completed successfully for listing:', listing_id)

    return new Response(
      JSON.stringify({ success: true, listing_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    
    // Update status to failed if we have listing_id
    if (listingId) {
      await updateStatus('failed', listingId)
    }

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        listing_id: listingId 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

