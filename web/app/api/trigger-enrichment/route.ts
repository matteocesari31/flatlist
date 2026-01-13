import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { listing_id } = await req.json()

    if (!listing_id) {
      return NextResponse.json(
        { error: 'Missing listing_id' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Trigger enrichment
    const enrichUrl = `${supabaseUrl}/functions/v1/enrich-listing`
    const response = await fetch(enrichUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ listing_id }),
    })

    const responseText = await response.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { message: responseText }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: responseData.error || 'Failed to trigger enrichment', details: responseData.details },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, message: 'Enrichment triggered' })
  } catch (error: any) {
    console.error('Error in trigger-enrichment API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

