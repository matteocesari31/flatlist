import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== send-invitation function called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Processing request...')
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Authorization header present:', !!authHeader)
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    let supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) {
      const requestUrl = new URL(req.url)
      const hostname = requestUrl.hostname
      if (hostname.includes('supabase.co')) {
        const projectRef = hostname.split('.')[0]
        supabaseUrl = `https://${projectRef}.supabase.co`
      } else {
        supabaseUrl = 'https://zvmsgnctdokhlwmwhqhx.supabase.co'
      }
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id, user.email)

    // Parse request body
    let requestBody
    try {
      requestBody = await req.json()
      console.log('Request body:', requestBody)
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { catalogId, invitedEmail } = requestBody

    console.log('Validating request body...')
    if (!catalogId || !invitedEmail) {
      console.error('Missing catalogId or invitedEmail')
      return new Response(
        JSON.stringify({ error: 'Missing catalogId or invitedEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    console.log('Validating email format...')
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(invitedEmail)) {
      console.error('Invalid email format:', invitedEmail)
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is a member of the catalog
    console.log('Checking catalog membership...', { catalogId, userId: user.id })
    const { data: memberCheck, error: memberError } = await supabase
      .from('catalog_members')
      .select('id')
      .eq('catalog_id', catalogId)
      .eq('user_id', user.id)
      .single()

    console.log('Membership check result:', { memberCheck, memberError })

    if (memberError || !memberCheck) {
      console.error('User is not a member of the catalog:', memberError)
      return new Response(
        JSON.stringify({ error: 'You are not a member of this catalog' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is premium (only premium users can invite)
    console.log('Checking user subscription...')
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('plan, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle()

    // Determine if user is premium
    let isPremium = subscription?.plan === 'premium'
    if (isPremium && subscription?.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end)
      isPremium = periodEnd > new Date()
    }

    console.log('User subscription:', { plan: subscription?.plan, isPremium })

    if (!isPremium) {
      console.error('Free user attempted to invite:', user.id)
      return new Response(
        JSON.stringify({ 
          error: 'Premium required',
          message: 'Only Premium users can invite collaborators. Upgrade to Premium to unlock multiplayer mode.',
          upgradeRequired: true
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for existing pending invitation (including expired ones that we can resend)
    console.log('Checking for existing invitations...')
    const { data: existingInvitation, error: existingInvitationError } = await supabase
      .from('catalog_invitations')
      .select('id, token, expires_at')
      .eq('catalog_id', catalogId)
      .eq('invited_email', invitedEmail.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle()

    console.log('Existing invitation check:', { existingInvitation, existingInvitationError })

    if (existingInvitationError) {
      console.error('Error checking existing invitation:', existingInvitationError)
      // Don't fail on this error, just log it
    }

    // Get catalog name (needed for both new and existing invitations)
    const { data: catalog, error: catalogError } = await supabase
      .from('catalogs')
      .select('name')
      .eq('id', catalogId)
      .single()

    if (catalogError || !catalog) {
      return new Response(
        JSON.stringify({ error: 'Catalog not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let invitation
    let isResend = false

    if (existingInvitation) {
      // Resend existing invitation - update expiration date
      console.log('Resending existing invitation:', existingInvitation.id)
      isResend = true
      
      const { data: updatedInvitation, error: updateError } = await supabase
        .from('catalog_invitations')
        .update({
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Reset to 30 days
          invited_by: user.id, // Update inviter in case it's a different user
        })
        .eq('id', existingInvitation.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating invitation:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update invitation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      invitation = updatedInvitation
    } else {
      // Create new invitation
      console.log('Creating new invitation')
      
      // Generate unique token
      const tokenArray = new Uint8Array(32)
      crypto.getRandomValues(tokenArray)
      const token = Array.from(tokenArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const { data: newInvitation, error: invitationError } = await supabase
        .from('catalog_invitations')
        .insert({
          catalog_id: catalogId,
          invited_by: user.id,
          invited_email: invitedEmail.toLowerCase(),
          token,
          status: 'pending',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })
        .select()
        .single()

      if (invitationError) {
        console.error('Error creating invitation:', invitationError)
        return new Response(
          JSON.stringify({ error: 'Failed to create invitation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      invitation = newInvitation
    }

    // Get inviter's email (user object already has email)
    const inviterEmail = user.email || 'someone'
    const inviterName = inviterEmail.split('@')[0] || 'Someone'

    // Build invitation URL (use invitation token)
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000'
    const acceptUrl = `${siteUrl}/invite/accept?token=${invitation.token}`

    // Helper function to escape HTML
    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }

    // Send email using Resend (requires RESEND_API_KEY and verified domain for production)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'
    let emailSent = false

    if (resendApiKey) {
      try {
        // Escape variables for HTML
        const safeInviterName = escapeHtml(inviterName)
        const safeInviterEmail = escapeHtml(inviterEmail)
        const safeCatalogName = escapeHtml(catalog.name)
        const safeAcceptUrl = escapeHtml(acceptUrl)

        // Create HTML email template
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to collaborate</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e5e5;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #FF5C5C;">flatlist</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                You've been invited to collaborate!
              </h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                <strong>${safeInviterName}</strong> (${safeInviterEmail}) has invited you to collaborate on the catalog <strong>"${safeCatalogName}"</strong>.
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Click the button below to accept the invitation and start sharing listings together.
              </p>
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${acceptUrl}" style="display: inline-block; padding: 14px 32px; background-color: #FF5C5C; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; text-align: center;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #8a8a8a;">
                Or copy and paste this link into your browser:<br>
                <a href="${acceptUrl}" style="color: #FF5C5C; word-break: break-all;">${safeAcceptUrl}</a>
              </p>
              <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: #8a8a8a;">
                This invitation will expire in 30 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; text-align: center; border-top: 1px solid #e5e5e5; background-color: #f9f9f9;">
              <p style="margin: 0; font-size: 12px; color: #8a8a8a;">
                This email was sent by flatlist. If you have any questions, please contact the person who invited you.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `

        const emailText = `
You've been invited to collaborate!

${inviterName} (${inviterEmail}) has invited you to collaborate on the catalog "${catalog.name}".

Click the link below to accept the invitation:
${acceptUrl}

This invitation will expire in 30 days. If you didn't expect this invitation, you can safely ignore this email.
        `.trim()

        // Send email via Resend API
        const toEmail = invitedEmail.toLowerCase()
        console.log('Attempting to send email via Resend:', { to: toEmail, from: fromEmail })
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `flatlist <${fromEmail}>`,
            to: [toEmail],
            subject: `You've been invited to collaborate on "${catalog.name}"`,
            html: emailHtml,
            text: emailText,
          }),
        })

        const responseBody = await resendResponse.text()
        console.log('Resend API response:', { status: resendResponse.status, body: responseBody })

        if (!resendResponse.ok) {
          let errorMessage = 'Failed to send email'
          try {
            const errorJson = JSON.parse(responseBody)
            errorMessage = errorJson.message || errorJson.error?.message || responseBody
          } catch {
            errorMessage = responseBody || `HTTP ${resendResponse.status}`
          }
          console.error('Resend API error:', resendResponse.status, errorMessage)
          emailSent = false
        } else {
          try {
            const resendData = JSON.parse(responseBody)
            console.log('Resend accepted email:', { id: resendData.id, to: toEmail })
            emailSent = true
          } catch (e) {
            console.error('Failed to parse Resend response:', e)
            emailSent = false
          }
        }
      } catch (emailError: any) {
        console.error('Error sending email via Resend:', emailError)
        emailSent = false
      }
    } else {
      console.log('RESEND_API_KEY not configured. Invitation created (no email sent):', {
        invitedEmail: invitedEmail.toLowerCase(),
        catalogName: catalog.name,
        acceptUrl,
        note: 'Set RESEND_API_KEY in Supabase Edge Function secrets and verify your domain in Resend to send invitation emails.',
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        resend: isResend,
        emailSent,
        acceptUrl,
        invitation: {
          id: invitation.id,
          token: invitation.token,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in send-invitation:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause,
    })
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

