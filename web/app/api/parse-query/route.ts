import { NextRequest, NextResponse } from 'next/server'
import { parseSearchQuery } from '@/lib/ai-search'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const result = await parseSearchQuery(query, openaiApiKey)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error parsing query:', error)
    return NextResponse.json(
      { error: 'Failed to parse query', details: error.message },
      { status: 500 }
    )
  }
}

