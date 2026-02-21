# Multiplayer Catalog Sharing - Setup Guide

Follow these steps to complete the multiplayer catalog sharing implementation:

## Step 1: Run Database Migration

You need to apply the new migration that creates the catalog sharing tables.

### Option A: Using Supabase Web Interface (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Open `supabase/migrations/006_multiplayer_catalogs.sql` and copy its entire contents
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd+Enter)
7. You should see "Success. No rows returned"

**Important:** This migration will:
- Create new tables: `catalogs`, `catalog_members`, `catalog_invitations`, `listing_notes`
- Migrate existing listings to default catalogs for each user
- Migrate existing notes from `listings.notes` to `listing_notes` table
- Update RLS policies to support catalog-based sharing

### Option B: Using Supabase CLI

```bash
supabase db push
```

## Step 2: Deploy the send-invitation Edge Function

### Option A: Using Supabase Web Interface

1. Go to **Edge Functions** in the Supabase dashboard
2. Click **Create a new function**
3. Name it: `send-invitation`
4. Copy the contents of `supabase/functions/send-invitation/index.ts`
5. Paste into the function editor
6. Click **Deploy**

### Option B: Using Supabase CLI

```bash
supabase functions deploy send-invitation
```

## Step 3: Set Environment Variables

### For Edge Function (send-invitation)

1. In Supabase dashboard, go to **Edge Functions** → **send-invitation**
2. Go to **Settings** → **Secrets**
3. Add the following secret (if not already set):
   - Key: `SITE_URL`
   - Value: `http://localhost:3000` (for development) or your production URL

**Note:** The function also needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` which should already be set.

## Step 4: Update Auth Page to Handle Invitation Tokens

The auth page needs to redirect to the invitation acceptance page after signup if there's an invitation token.

Update `web/app/auth/page.tsx` to check for invitation tokens:

```typescript
// Add this after the signup/signin logic
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const inviteToken = urlParams.get('invite_token')
  
  if (inviteToken) {
    // Store token in sessionStorage to use after auth callback
    sessionStorage.setItem('pending_invite_token', inviteToken)
  }
}, [])
```

And update `web/app/auth/callback/route.ts` to redirect to invitation acceptance:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Check for pending invitation token
  const inviteToken = requestUrl.searchParams.get('invite_token')
  if (inviteToken) {
    return NextResponse.redirect(new URL(`/invite/accept?token=${inviteToken}`, requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
```

## Step 5: Test the Implementation

1. **Test Invitation Flow:**
   - Log in as User A
   - Click the "+" button next to your profile icon
   - Enter User B's email address
   - Click "Send Invitation"
   - Check the console/logs for the invitation URL (email sending is not yet configured)

2. **Test Invitation Acceptance:**
   - Copy the invitation URL from logs (format: `/invite/accept?token=...`)
   - If User B is not logged in, they should be redirected to signup
   - After signup, they should see the merge choice modal
   - If User B is already logged in, they should see the merge choice modal directly

3. **Test Shared Catalog:**
   - Both users should see the same listings
   - Both users can add and manage listings in the shared catalog

## Step 6: Configure Email Sending (Optional but Recommended)

Currently, invitations are created but emails are not sent. To enable email sending:

### Option A: Use Supabase Email (if configured)
Update `supabase/functions/send-invitation/index.ts` to use Supabase's email service.

### Option B: Use External Email Service (Recommended for Production)
Integrate with a service like:
- **Resend** (recommended)
- **SendGrid**
- **AWS SES**

Example with Resend:
```typescript
// Add to send-invitation function
const resendApiKey = Deno.env.get('RESEND_API_KEY')
if (resendApiKey) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'noreply@yourdomain.com',
      to: invitedEmail,
      subject: `You've been invited to collaborate on ${catalog.name}`,
      html: `...invitation email HTML...`,
    }),
  })
}
```

## Troubleshooting

### Migration Errors
- If you get errors about existing policies, you may need to drop them first:
  ```sql
  DROP POLICY IF EXISTS "Users can view their own listings" ON listings;
  -- etc.
  ```

### RLS Policy Errors
- Make sure you're logged in when testing
- Check that catalog_members entries are created correctly
- Verify that listings have catalog_id set

### Edge Function Errors
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function secrets
- Verify `SITE_URL` is set correctly
- Check function logs in Supabase dashboard

### Note Display Issues
- Ensure `listing_notes` table has data
- Check that `fetchListings` includes `listing_notes` in the select query
- Verify user colors are being generated correctly

## Next Steps

After completing setup:
1. Test with multiple users
2. Configure email sending for production
3. Consider adding UI to show catalog members
4. Add ability to remove collaborators
5. Add catalog name editing for shared catalogs

