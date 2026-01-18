import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user (optional - feedback can be from logged out users too)
    const { data: { user } } = await supabase.auth.getUser()
    
    const body = await request.json()
    const { type, message, userEmail } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const feedbackTypeLabels: Record<string, string> = {
      question: '❓ Question',
      suggestion: '💡 Suggestion',
      bug: '🐛 Bug Report',
    }

    const typeLabel = feedbackTypeLabels[type] || 'Feedback'
    const senderEmail = userEmail || user?.email || 'Anonymous'

    // Check if Resend is configured
    const resendApiKey = process.env.RESEND_API_KEY

    if (resendApiKey) {
      // Send email via Resend
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'flatlist <noreply@flatlist.app>',
          to: ['team@flatlist.app'],
          subject: `[flatlist] ${typeLabel} from ${senderEmail}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${typeLabel}</h2>
              <p style="color: #666; font-size: 14px;">From: <strong>${senderEmail}</strong></p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">
                ${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #999; font-size: 12px;">
                Sent from flatlist feedback form
              </p>
            </div>
          `,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Resend error:', error)
        throw new Error('Failed to send email')
      }
    } else {
      // Fallback: Log the feedback (for development or when Resend isn't configured)
      console.log('=== FEEDBACK RECEIVED ===')
      console.log('Type:', typeLabel)
      console.log('From:', senderEmail)
      console.log('Message:', message)
      console.log('========================')
      
      // In production without Resend, you might want to store in database instead
      // For now, we'll just log it and return success
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Feedback error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send feedback' },
      { status: 500 }
    )
  }
}
