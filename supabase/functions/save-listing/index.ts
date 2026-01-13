import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Log ALL requests immediately
  console.log('=== REQUEST RECEIVED ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight - returning ok')
    return new Response('ok', { headers: corsHeaders })
  }

  // Debug endpoint to check environment variables (remove in production)
  // This endpoint doesn't require authentication
  const url = new URL(req.url)
  if (req.method === 'GET' && url.searchParams.get('debug') === 'env') {
    try {
      // Try multiple ways to get SUPABASE_URL
      const supabaseUrlFromEnv = Deno.env.get('SUPABASE_URL')
      
      // Extract from request URL as fallback
      const hostname = url.hostname
      let extractedUrl = null
      if (hostname.includes('supabase.co')) {
        // Extract project ref from hostname (e.g., zvmsgnctdokhlwmwhqhx.supabase.co)
        const parts = hostname.split('.')
        if (parts.length >= 2) {
          extractedUrl = `https://${parts[0]}.supabase.co`
        }
      }
      
      const hasServiceKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      const allEnvVars = Object.keys(Deno.env.toObject()).filter(k => k.includes('SUPABASE'))
      
      return new Response(
        JSON.stringify({ 
          supabaseUrlFromEnv: supabaseUrlFromEnv || 'NOT SET',
          extractedFromRequest: extractedUrl,
          hasServiceKey: hasServiceKey,
          expectedUrl: 'https://zvmsgnctdokhlwmwhqhx.supabase.co',
          availableEnvVars: allEnvVars,
          // Use extracted URL or fallback to expected
          recommendedUrl: supabaseUrlFromEnv || extractedUrl || 'https://zvmsgnctdokhlwmwhqhx.supabase.co',
          requestHostname: hostname
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Debug endpoint error', details: error.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  }

  try {
    console.log('Processing request...')
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Authorization header present?', !!authHeader)
    console.log('Authorization header length:', authHeader?.length || 0)
    
    if (!authHeader) {
      console.log('ERROR: Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    // Try to get SUPABASE_URL from env, or extract from request URL
    let supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) {
      // Extract from request URL as fallback
      const requestUrl = new URL(req.url)
      const hostname = requestUrl.hostname
      if (hostname.includes('supabase.co')) {
        // Extract project ref from hostname (e.g., zvmsgnctdokhlwmwhqhx.supabase.co)
        const projectRef = hostname.split('.')[0]
        supabaseUrl = `https://${projectRef}.supabase.co`
      } else {
        // Fallback to hardcoded value
        supabaseUrl = 'https://zvmsgnctdokhlwmwhqhx.supabase.co'
      }
    }
    
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseServiceKey) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error', details: 'Missing SUPABASE_SERVICE_ROLE_KEY secret. Set it in Supabase Dashboard → Edge Functions → Secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Using SUPABASE_URL:', supabaseUrl)
    console.log('Service key length:', supabaseServiceKey.length)
    console.log('Service key first 10 chars:', supabaseServiceKey.substring(0, 10))
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    
    // Decode token to check issuer
    try {
      const tokenParts = token.split('.')
      if (tokenParts.length !== 3) {
        return new Response(
          JSON.stringify({ error: 'Invalid token format' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')))
      const tokenIssuer = payload.iss || ''
      const expectedIssuer = `${supabaseUrl}/auth/v1`
      const tokenExp = payload.exp || 0
      const now = Math.floor(Date.now() / 1000)
      const isExpired = tokenExp < now
      
      console.log('Token issuer:', tokenIssuer)
      console.log('Expected issuer:', expectedIssuer)
      console.log('Issuer matches?', tokenIssuer === expectedIssuer)
      console.log('Token expires at:', new Date(tokenExp * 1000).toISOString())
      console.log('Current time:', new Date(now * 1000).toISOString())
      console.log('Token expired?', isExpired)
      console.log('Token expires in (seconds):', tokenExp - now)
      console.log('SUPABASE_URL from env:', supabaseUrl)
      
      if (tokenIssuer !== expectedIssuer) {
        return new Response(
          JSON.stringify({ 
            error: 'Token issuer mismatch', 
            details: `Token is for ${tokenIssuer}, but server expects ${expectedIssuer}. Check SUPABASE_URL environment variable.` 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (isExpired) {
        return new Response(
          JSON.stringify({ 
            error: 'Token expired', 
            details: `Token expired at ${new Date(tokenExp * 1000).toISOString()}. Get a fresh token.` 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch (decodeError) {
      console.error('Token decode error:', decodeError)
      return new Response(
        JSON.stringify({ error: 'Invalid token format', details: 'Could not decode token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Log token details for debugging
    console.log('Token length:', token.length)
    console.log('Token first 50 chars:', token.substring(0, 50))
    console.log('Token last 50 chars:', token.substring(token.length - 50))
    console.log('Supabase URL:', supabaseUrl)
    
    // Try to get user with the token
    console.log('Attempting to validate token with Supabase...')
    console.log('Using SUPABASE_URL:', supabaseUrl)
    console.log('Token first 20 chars:', token.substring(0, 20))
    console.log('Token last 20 chars:', token.substring(token.length - 20))
    
    // Try to validate the token
    console.log('Calling supabase.auth.getUser()...')
    const authResult = await supabase.auth.getUser(token)
    const { data: { user }, error: authError } = authResult
    
    console.log('Auth result:', {
      hasUser: !!user,
      hasError: !!authError,
      errorMessage: authError?.message,
      errorStatus: authError?.status,
      errorName: authError?.name
    })
    
    if (authError) {
      console.error('Auth error details:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
        stack: authError.stack
      })
      
      // Log the full error object
      console.error('Full auth error:', JSON.stringify(authError, null, 2))
      
      // Check if it's a JWT signature error
      if (authError.message.includes('JWT') || authError.message.includes('jwt') || authError.message.includes('signature')) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid JWT token', 
            details: `Supabase auth error: ${authError.message}. This usually means: 1) Token signature is invalid, 2) Token is from a different Supabase project, 3) Service role key is incorrect.`,
            debug: {
              tokenLength: token.length,
              supabaseUrl: supabaseUrl,
              tokenIssuer: payload.iss,
              tokenExp: payload.exp,
              tokenExpired: payload.exp < Math.floor(Date.now() / 1000),
              errorMessage: authError.message,
              errorStatus: authError.status
            }
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or expired token', 
          details: authError.message,
          debug: {
            errorName: authError.name,
            errorStatus: authError.status
          }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', details: 'No user found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('User authenticated:', user.id, user.email)

    // Parse request body
    console.log('=== PARSING REQUEST BODY ===')
    const body = await req.json()
    console.log('Request body keys:', Object.keys(body))
    console.log('Request body:', JSON.stringify(body, null, 2))
    const { url, title, price, images, content } = body

    console.log('Extracted fields:', {
      hasUrl: !!url,
      hasContent: !!content,
      contentLength: content?.length || 0,
      hasTitle: !!title,
      hasPrice: !!price,
      imagesCount: images?.length || 0
    })

    if (!url || !content) {
      console.error('❌ Missing required fields:', { hasUrl: !!url, hasContent: !!content })
      return new Response(
        JSON.stringify({ error: 'Missing required fields: url and content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Request body validation passed')

    // Check if listing already exists for this user
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('user_id', user.id)
      .eq('source_url', url)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ 
          error: 'Listing already saved',
          listing_id: existing.id 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert listing
    console.log('=== INSERTING LISTING ===')
    console.log('User ID:', user.id)
    console.log('Source URL:', url)
    console.log('Content length:', content?.length || 0)
    console.log('Images count:', images?.length || 0)
    console.log('Images data:', images)
    console.log('Images type:', typeof images)
    console.log('Images is array:', Array.isArray(images))
    
    // Ensure images is an array or null
    let imagesToStore: string[] | null = null
    if (images && Array.isArray(images) && images.length > 0) {
      imagesToStore = images
    } else if (images && typeof images === 'string') {
      // Try to parse if it's a JSON string
      try {
        const parsed = JSON.parse(images)
        imagesToStore = Array.isArray(parsed) && parsed.length > 0 ? parsed : null
      } catch {
        imagesToStore = null
      }
    }
    
    console.log('Images to store:', imagesToStore)
    
    // Get user's default catalog (the one they created or are a member of)
    let catalogId: string | null = null
    
    // First, try to get a catalog the user is a member of
    const { data: catalogMembers, error: memberError } = await supabase
      .from('catalog_members')
      .select('catalog_id')
      .eq('user_id', user.id)
      .limit(1)
    
    if (catalogMembers && catalogMembers.length > 0) {
      catalogId = catalogMembers[0].catalog_id
      console.log('Found catalog membership:', catalogId)
    } else {
      // If no membership, try to get a catalog the user created
      const { data: defaultCatalogs, error: catalogError } = await supabase
        .from('catalogs')
        .select('id')
        .eq('created_by', user.id)
        .limit(1)
      
      if (defaultCatalogs && defaultCatalogs.length > 0) {
        catalogId = defaultCatalogs[0].id
        console.log('Found catalog created by user:', catalogId)
        // Ensure user is a member (ignore error if already a member)
        await supabase
          .from('catalog_members')
          .insert({
            catalog_id: catalogId,
            user_id: user.id,
          })
          .select()
      } else {
        // Create default catalog if none exists
        console.log('Creating new catalog for user')
        const { data: newCatalog, error: createError } = await supabase
          .from('catalogs')
          .insert({
            name: 'My Listings',
            created_by: user.id,
          })
          .select()
          .single()
        
        if (createError) {
          console.error('Error creating catalog:', createError)
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create catalog', 
              details: createError.message 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (newCatalog && newCatalog.id) {
          catalogId = newCatalog.id
          console.log('Created new catalog:', catalogId)
          // Add user as member
          const { error: memberInsertError } = await supabase
            .from('catalog_members')
            .insert({
              catalog_id: newCatalog.id,
              user_id: user.id,
            })
          
          if (memberInsertError) {
            console.error('Error adding user to catalog:', memberInsertError)
            // This is non-critical, but log it
          }
        }
      }
    }
    
    if (!catalogId) {
      console.error('Failed to get or create catalog for user')
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get catalog', 
          details: 'Could not determine catalog for listing',
          debug: {
            memberError: memberError?.message,
            userId: user.id
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Using catalog ID:', catalogId)
    
    const insertData: any = {
      user_id: user.id,
      catalog_id: catalogId,
      source_url: url,
      title: title || null,
      raw_content: content,
      images: imagesToStore, // Always include, even if null
      enrichment_status: 'pending'
    }
    
    console.log('Inserting listing with images:', {
      hasImages: !!imagesToStore,
      imagesCount: imagesToStore ? imagesToStore.length : 0,
      imagesValue: imagesToStore,
      catalogId: catalogId
    })
    
    const { data: listing, error: insertError } = await supabase
      .from('listings')
      .insert(insertData)
      .select()
      .single()
    
    if (listing) {
      console.log('✅ Listing inserted. Images in response:', listing.images)
    }

    if (insertError) {
      console.error('❌ Error inserting listing:', insertError)
      console.error('Insert error details:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      })
      return new Response(
        JSON.stringify({ error: 'Failed to save listing', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!listing) {
      console.error('❌ Listing insert returned no data')
      return new Response(
        JSON.stringify({ error: 'Failed to save listing', details: 'No listing data returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Listing inserted successfully:', listing.id)
    console.log('Listing title:', listing.title)
    console.log('Listing status:', listing.enrichment_status)

    // Trigger enrichment asynchronously (don't await - fire and forget)
    const enrichUrl = `${supabaseUrl}/functions/v1/enrich-listing`
    console.log('=== TRIGGERING ENRICHMENT ===')
    console.log('Listing ID:', listing.id)
    console.log('Enrichment URL:', enrichUrl)
    console.log('Supabase URL:', supabaseUrl)
    console.log('Service key length:', supabaseServiceKey?.length || 0)
    console.log('Service key first 20 chars:', supabaseServiceKey?.substring(0, 20) || 'MISSING')
    
    // Use fire-and-forget but with better error handling
    fetch(enrichUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ listing_id: listing.id }),
    })
    .then(async (response) => {
      console.log('=== ENRICHMENT TRIGGER RESPONSE ===')
      console.log('Status:', response.status)
      console.log('Status text:', response.statusText)
      const responseText = await response.text()
      console.log('Response body:', responseText)
      
      if (!response.ok) {
        console.error('❌ Enrichment trigger FAILED:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        })
      } else {
        console.log('✅ Enrichment triggered successfully')
      }
    })
    .catch(err => {
      console.error('❌ ERROR triggering enrichment:', err)
      console.error('Error name:', err.name)
      console.error('Error message:', err.message)
      console.error('Error stack:', err.stack)
      console.error('Error cause:', err.cause)
    })
    
    console.log('Enrichment trigger initiated (async, not blocking response)')

    return new Response(
      JSON.stringify({ 
        success: true, 
        listing_id: listing.id,
        message: 'Listing saved successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

