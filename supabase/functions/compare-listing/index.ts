import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Truncate content to max length, preserving top, middle, and bottom
function truncateContent(content: string, maxLength: number = 8000): string {
  if (!content) return ''
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
  console.log('=== COMPARE-LISTING REQUEST RECEIVED ===')
  console.log('Method:', req.method)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const requestBody = await req.json()
    const { listing_id, user_id, compare_all } = requestBody

    console.log('Request body:', { listing_id, user_id, compare_all })

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Fetch user's dream apartment description
    console.log('Fetching user preferences...')
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('dream_apartment_description')
      .eq('user_id', user_id)
      .single()

    if (prefError || !preferences?.dream_apartment_description) {
      console.log('No dream apartment description found for user')
      return new Response(
        JSON.stringify({ error: 'No dream apartment description set', code: 'NO_DESCRIPTION' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const dreamDescription = preferences.dream_apartment_description
    console.log('Dream description length:', dreamDescription.length)

    // Determine which listings to compare
    let listingIds: string[] = []
    
    if (compare_all) {
      // Fetch all listings for this user (from catalogs they have access to)
      console.log('Fetching all listings for user...')
      
      // Get user's catalog memberships
      const { data: memberships } = await supabase
        .from('catalog_members')
        .select('catalog_id')
        .eq('user_id', user_id)

      const catalogIds = memberships?.map(m => m.catalog_id) || []
      
      // Also get catalogs owned by user
      const { data: ownedCatalogs } = await supabase
        .from('catalogs')
        .select('id')
        .eq('owner_id', user_id)

      const ownedCatalogIds = ownedCatalogs?.map(c => c.id) || []
      const allCatalogIds = [...new Set([...catalogIds, ...ownedCatalogIds])]

      if (allCatalogIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, compared: 0, message: 'No catalogs found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get all listings from those catalogs
      const { data: listings } = await supabase
        .from('listings')
        .select('id')
        .in('catalog_id', allCatalogIds)
        .eq('enrichment_status', 'done')

      listingIds = listings?.map(l => l.id) || []
    } else if (listing_id) {
      listingIds = [listing_id]
    } else {
      return new Response(
        JSON.stringify({ error: 'Must provide listing_id or set compare_all to true' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Listings to compare:', listingIds.length)

    if (listingIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, compared: 0, message: 'No listings to compare' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not set')
    }

    const results: Array<{ listing_id: string; success: boolean; score?: number; error?: string }> = []

    // Process listings in parallel (batches of 3 to avoid rate limits)
    const batchSize = 3
    for (let i = 0; i < listingIds.length; i += batchSize) {
      const batch = listingIds.slice(i, i + batchSize)
      
      const batchResults = await Promise.all(batch.map(async (lid) => {
      try {
        console.log(`Processing listing: ${lid}`)
        
        // Fetch listing with metadata
        const { data: listing, error: listingError } = await supabase
          .from('listings')
          .select(`
            id,
            raw_content,
            images,
            listing_metadata (
              address,
              latitude,
              longitude,
              price,
              size_sqm,
              rooms,
              bedrooms,
              bathrooms
            )
          `)
          .eq('id', lid)
          .single()

        if (listingError || !listing) {
          console.error('Error fetching listing:', listingError)
          return { listing_id: lid, success: false, error: 'Listing not found' }
        }

        const metadata = listing.listing_metadata as any
        const truncatedContent = truncateContent(listing.raw_content || '', 6000)

        // Build location info string
        let locationInfo = ''
        if (metadata?.address) {
          locationInfo = `Address: ${metadata.address}`
          if (metadata?.latitude && metadata?.longitude) {
            locationInfo += ` (Coordinates: ${metadata.latitude}, ${metadata.longitude})`
          }
        }

        // Build listing summary
        let listingSummary = ''
        if (metadata?.price) listingSummary += `Price: ${metadata.price}\n`
        if (metadata?.size_sqm) listingSummary += `Size: ${metadata.size_sqm} sqm\n`
        if (metadata?.rooms) listingSummary += `Rooms: ${metadata.rooms}\n`
        if (metadata?.bedrooms) listingSummary += `Bedrooms: ${metadata.bedrooms}\n`
        if (metadata?.bathrooms) listingSummary += `Bathrooms: ${metadata.bathrooms}\n`

        // Build OpenAI messages
        const messages: any[] = [
          {
            role: 'system',
            content: `You are an expert real estate assistant evaluating how well an apartment listing matches a user's dream apartment description.

Your task is to:
1. Carefully analyze the user's dream apartment description to understand what they're looking for
2. Compare the listing details, images, and location against those preferences
3. Provide a match score from 0 to 100 where:
   - 0-20: Poor match, very few preferences satisfied
   - 21-40: Below average, some basic criteria met
   - 41-60: Average match, several preferences met but key ones missing
   - 61-80: Good match, most preferences satisfied
   - 81-100: Excellent match, nearly all preferences satisfied
4. Write a 2-3 sentence summary explaining HOW this listing compares to the user's vision

Consider ALL aspects the user mentions including:
- Location preferences (neighborhood, proximity to landmarks, transportation)
- Size and layout (rooms, bedrooms, space)
- Style and condition (modern, renovated, cozy, etc.)
- Amenities (balcony, parking, etc.)
- Price range if mentioned
- Any specific requirements or deal-breakers

Return ONLY valid JSON in this exact format:
{
  "score": 75,
  "summary": "This apartment offers the bright, modern aesthetic you're looking for with large windows and renovated interiors. While it's slightly above your budget and lacks a balcony, its prime location near the metro and open layout align well with your preferences."
}`
          }
        ]

        // Build user message with text and optionally images
        const userMessageContent: any[] = [
          {
            type: 'text',
            text: `## User's Dream Apartment Description:
${dreamDescription}

## Listing Details:
${listingSummary}
${locationInfo}

## Full Listing Content:
${truncatedContent}`
          }
        ]

        // Add images if available (max 2 for cost efficiency)
        if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
          console.log('Adding images to analysis:', listing.images.length)
          for (const imageUrl of listing.images.slice(0, 2)) {
            try {
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
              console.warn('Failed to fetch image:', imageUrl)
            }
          }
        }

        messages.push({
          role: 'user',
          content: userMessageContent
        })

        // Call OpenAI
        const hasImages = userMessageContent.some(c => c.type === 'image_url')
        const model = hasImages ? 'gpt-4o' : 'gpt-3.5-turbo'
        
        console.log(`Calling OpenAI (${model})...`)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            max_tokens: 300
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          console.error('OpenAI API error:', errorText)
          return { listing_id: lid, success: false, error: 'OpenAI API error' }
        }

        const openaiData = await openaiResponse.json()
        const content = openaiData.choices[0]?.message?.content

        if (!content) {
          return { listing_id: lid, success: false, error: 'No content from OpenAI' }
        }

        // Parse response
        let comparison
        try {
          comparison = JSON.parse(content)
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', content)
          return { listing_id: lid, success: false, error: 'Invalid JSON from OpenAI' }
        }

        const score = Math.max(0, Math.min(100, Math.round(comparison.score || 0)))
        const summary = comparison.summary || ''

        console.log(`Comparison result for ${lid}: score=${score}`)

        // Upsert comparison result
        const { error: upsertError } = await supabase
          .from('listing_comparisons')
          .upsert({
            listing_id: lid,
            user_id: user_id,
            match_score: score,
            comparison_summary: summary,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'listing_id,user_id'
          })

        if (upsertError) {
          console.error('Error saving comparison:', upsertError)
          return { listing_id: lid, success: false, error: 'Failed to save comparison' }
        }

        return { listing_id: lid, success: true, score }

      } catch (listingError) {
        console.error(`Error processing listing ${lid}:`, listingError)
        return { listing_id: lid, success: false, error: String(listingError) }
      }
      }))
      
      // Add batch results to overall results
      results.push(...batchResults)

      // Small delay between batches to avoid rate limits
      if (i + batchSize < listingIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const successCount = results.filter(r => r.success).length
    console.log(`Comparison complete: ${successCount}/${listingIds.length} successful`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        compared: successCount,
        total: listingIds.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
