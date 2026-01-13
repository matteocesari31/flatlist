import { NextRequest, NextResponse } from 'next/server'

export interface LocationDetectionResult {
  hasLocation: boolean
  detectedLocation: string | null    // Full geocodable string: "Susa Metro Station Milan Italy"
  displayName: string | null         // Display name with city: "Susa Metro Station, Milan"
  remainingQuery: string             // Query with location removed: "flat 2 beds"
  defaultDistance: number            // Default distance in km (usually 1.5)
  city: string | null                // Detected city name
}

async function detectLocation(query: string, openaiApiKey: string): Promise<LocationDetectionResult> {
  const systemPrompt = `You are a location extractor for apartment search queries. Your ONLY job is to detect if the query mentions a specific location (metro station, university, landmark, neighborhood, address) and extract it.

RESPOND ONLY WITH JSON in this exact format:
{
  "hasLocation": true/false,
  "detectedLocation": "Full geocodable string with city/country" or null,
  "displayName": "Location name with city" or null,
  "city": "City name" or null,
  "remainingQuery": "Query with location phrase removed",
  "defaultDistance": 1.5
}

EXAMPLES:

Query: "flat near susa metro 2 beds"
Response: {"hasLocation": true, "detectedLocation": "Susa Metro Station Milan Italy", "displayName": "Susa Metro Station, Milan", "city": "Milan", "remainingQuery": "flat 2 beds", "defaultDistance": 1.5}

Query: "apartment close to bocconi university under 900"
Response: {"hasLocation": true, "detectedLocation": "Bocconi University Milan Italy", "displayName": "Bocconi University, Milan", "city": "Milan", "remainingQuery": "apartment under 900", "defaultDistance": 1.5}

Query: "quiet studio within 2km of central station in rome"
Response: {"hasLocation": true, "detectedLocation": "Central Station Rome Italy", "displayName": "Central Station, Rome", "city": "Rome", "remainingQuery": "quiet studio", "defaultDistance": 2}

Query: "2 bedroom apartment under 1000"
Response: {"hasLocation": false, "detectedLocation": null, "displayName": null, "city": null, "remainingQuery": "2 bedroom apartment under 1000", "defaultDistance": 1.5}

Query: "near m4 line bright apartment in milano"
Response: {"hasLocation": true, "detectedLocation": "M4 Metro Line Milan Italy", "displayName": "M4 Metro Line, Milan", "city": "Milan", "remainingQuery": "bright apartment", "defaultDistance": 1.5}

Query: "flat near eiffel tower paris"
Response: {"hasLocation": true, "detectedLocation": "Eiffel Tower Paris France", "displayName": "Eiffel Tower, Paris", "city": "Paris", "remainingQuery": "flat", "defaultDistance": 1.5}

Query: "apartment near times square new york"
Response: {"hasLocation": true, "detectedLocation": "Times Square New York USA", "displayName": "Times Square, New York", "city": "New York", "remainingQuery": "apartment", "defaultDistance": 1.5}

RULES:
- Location phrases include: "near X", "close to X", "within X km of Y", "by X", "next to X", "around X", "in X"
- Metro lines (M1, M2, M3, M4, M5), stations, universities, landmarks are locations
- Neighborhoods and areas are locations
- DETECT THE CITY from the query if mentioned (e.g., "in milan", "in rome", "milano", "paris", etc.)
- If distance is mentioned (e.g., "within 2km"), use that as defaultDistance
- If no distance mentioned but "near/close to" is used, defaultDistance is 1.5
- ALWAYS include city context in detectedLocation for geocoding accuracy
- displayName MUST include the city separated by comma (e.g., "Susa Metro Station, Milan")
- Remove the ENTIRE location phrase from remainingQuery, including "near", "close to", "in [city]", etc.
- If the city is mentioned separately from the location (e.g., "near duomo in milan"), extract both and combine them`

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
        { role: 'user', content: `Extract location from: "${query}"` }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorDetails
    try {
      errorDetails = JSON.parse(errorText)
    } catch {
      errorDetails = { message: errorText }
    }
    throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorDetails)}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No content in OpenAI response')
  }

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (parseError: any) {
    throw new Error(`Failed to parse OpenAI response: ${parseError.message}. Content: ${content.substring(0, 200)}`)
  }
  
  return {
    hasLocation: parsed.hasLocation || false,
    detectedLocation: parsed.detectedLocation || null,
    displayName: parsed.displayName || null,
    remainingQuery: parsed.remainingQuery || query,
    defaultDistance: parsed.defaultDistance || 1.5,
    city: parsed.city || null
  }
}

export async function POST(request: NextRequest) {
  let query: string | undefined
  
  try {
    // Parse request body with error handling
    try {
      const body = await request.json()
      query = body.query
    } catch (parseError: any) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid request body', details: 'Request body must be valid JSON with a "query" field' },
        { status: 400 }
      )
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required', details: 'The "query" field must be a non-empty string' },
        { status: 400 }
      )
    }

    // Skip detection for very short queries
    if (query.trim().length < 5) {
      return NextResponse.json({
        hasLocation: false,
        detectedLocation: null,
        displayName: null,
        remainingQuery: query,
        defaultDistance: 1.5,
        city: null
      })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'OpenAI API key not configured', details: 'OPENAI_API_KEY environment variable is missing' },
        { status: 500 }
      )
    }

    console.log('Calling detectLocation with query:', query.substring(0, 50))
    const result = await detectLocation(query, openaiApiKey)

    return NextResponse.json(result)
  } catch (error: any) {
    // Ensure we always return JSON, even for unexpected errors
    const errorMessage = error?.message || 'Unknown error'
    const isQuotaError = errorMessage.includes('insufficient_quota') || errorMessage.includes('quota')
    
    console.error('Error detecting location:', {
      message: errorMessage,
      name: error?.name,
      stack: error?.stack,
      query: query ? query.substring(0, 50) : 'unknown'
    })
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to detect location'
    if (isQuotaError) {
      userMessage = 'OpenAI API quota exceeded. Please check your billing and plan details.'
    } else if (errorMessage.includes('API key')) {
      userMessage = 'OpenAI API key issue. Please check your API key configuration.'
    }
    
    return NextResponse.json(
      { 
        error: userMessage, 
        details: isQuotaError ? 'OpenAI API quota has been exceeded. Please add credits to your OpenAI account.' : errorMessage,
        // Include more details in development
        ...(process.env.NODE_ENV === 'development' && { 
          stack: error?.stack,
          name: error?.name
        })
      },
      { status: 500 }
    )
  }
}

