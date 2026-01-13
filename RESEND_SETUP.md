# Resend Email Setup

This guide explains how to set up Resend for sending invitation emails in the flatlist application.

## Step 1: Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up for a free account
2. Verify your email address

## Step 2: Get Your API Key

1. After logging in, go to **API Keys** in the dashboard
2. Click **Create API Key**
3. Give it a name (e.g., "flatlist-invitations")
4. Select the **Sending access** permission
5. Copy the API key (you'll only see it once!)

## Step 3: Add Domain (Optional but Recommended)

For production, you should add your own domain:

1. Go to **Domains** in the Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Follow the DNS setup instructions to verify your domain
5. Once verified, you can use emails like `noreply@yourdomain.com`

For development/testing, you can use Resend's default domain: `onboarding@resend.dev`

## Step 4: Configure Supabase Edge Function

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **send-invitation**
3. Click on **Settings** or **Secrets**
4. Add the following secrets:
   - **Key**: `RESEND_API_KEY`
     - **Value**: Your Resend API key from Step 2
   - **Key**: `RESEND_FROM_EMAIL` (optional)
     - **Value**: Your verified email address (e.g., `noreply@yourdomain.com` or `onboarding@resend.dev`)
   - **Key**: `SITE_URL` (optional, but recommended)
     - **Value**: Your production URL (e.g., `https://yourdomain.com`)

### Option B: Using Supabase CLI

If you're using the Supabase CLI, you can set secrets using:

```bash
supabase secrets set RESEND_API_KEY=your_api_key_here
supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com
supabase secrets set SITE_URL=https://yourdomain.com
```

## Step 5: Test the Integration

1. In your flatlist app, click the "+" button next to your profile picture
2. Enter an email address to invite
3. Click "Send Invitation"
4. The invited person should receive an email with a link to accept the invitation

## Troubleshooting

### Emails Not Sending

1. **Check Resend Dashboard**: Go to Resend dashboard → **Logs** to see if emails are being sent and any errors
2. **Verify API Key**: Make sure `RESEND_API_KEY` is correctly set in Supabase Edge Function secrets
3. **Check From Email**: Ensure `RESEND_FROM_EMAIL` is a verified email address in Resend
4. **Check Edge Function Logs**: In Supabase dashboard, go to **Edge Functions** → **send-invitation** → **Logs** to see any errors

### Development Mode

If `RESEND_API_KEY` is not configured, the function will still create invitations but will only log the invitation URL to the console. This is useful for development when you don't want to send actual emails.

## Email Template

The invitation email includes:
- A branded header with the flatlist logo
- Clear invitation message with inviter's name and email
- Catalog name being shared
- A prominent "Accept Invitation" button
- A fallback link for copy/paste
- Expiration notice (30 days)

You can customize the email template in `supabase/functions/send-invitation/index.ts` by modifying the `emailHtml` variable.

## Cost

Resend offers a free tier with:
- 3,000 emails per month
- 100 emails per day

For most use cases, this should be sufficient. Check [resend.com/pricing](https://resend.com/pricing) for paid plans if you need more.

