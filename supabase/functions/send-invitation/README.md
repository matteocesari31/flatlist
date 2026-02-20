# Send Invitation Edge Function

Sends catalog collaboration invitations and optionally emails the invite link via Resend.

## Why invitation emails might not arrive

1. **Resend not configured** – The function only sends email if `RESEND_API_KEY` is set in Supabase Edge Function secrets. Without it, the invitation is still created and the API returns success, but no email is sent.
2. **Resend domain** – With the default `onboarding@resend.dev`, Resend only allows sending to your own Resend account email. To send to any address you must:
   - Verify your domain in the [Resend dashboard](https://resend.com/domains)
   - Set `RESEND_FROM_EMAIL` to a verified address (e.g. `noreply@yourdomain.com`)
3. **API errors** – If Resend returns an error (invalid key, rate limit, unverified domain, etc.), the function now reports `emailSent: false` and returns the invite link so the inviter can share it manually.

## Setup for production email

1. Create a [Resend](https://resend.com) account and get an API key.
2. In Resend, add and verify your domain (e.g. `flatlist.app`).
3. In Supabase Dashboard → Edge Functions → send-invitation → Secrets, set:
   - `RESEND_API_KEY` – your Resend API key
   - `RESEND_FROM_EMAIL` – e.g. `invites@yourdomain.com` (must use a verified domain)
   - `SITE_URL` – e.g. `https://my.flatlist.app` (used for the accept link in the email)

After deploying, invitation emails will be sent automatically when possible; if not, the app shows the invite link so the inviter can copy and share it.
