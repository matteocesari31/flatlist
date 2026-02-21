# Polar.sh Setup Guide

This guide explains how to set up Polar.sh for the flatlist premium/free subscription model.

## Prerequisites

- A Polar.sh account (sign up at https://polar.sh)
- Access to your Polar.sh organization dashboard

## Step 1: Create Organization

1. Go to https://polar.sh and sign in
2. Create a new organization for flatlist (or use existing)
3. Note down your **Organization ID** from the settings page

## Step 2: Create Products

### Free Plan
1. Go to Products → Create Product
2. Name: "Free Plan"
3. Description: "Save up to 12 listings. Solo mode only."
4. Price: €0.00 (Free)
5. Billing period: One-time (or leave as free)
6. Save and note the **Product ID**

### Premium Plan
1. Go to Products → Create Product
2. Name: "Premium Plan"
3. Description: "Unlimited listings. Invite collaborators. Multiplayer mode."
4. Price: €19.99
5. Billing period: Yearly
6. Save and note the **Product ID**

## Step 3: Generate API Access Token

1. Go to Settings → API Keys
2. Create a new API key with the following scopes:
   - `products:read`
   - `subscriptions:read`
   - `subscriptions:write`
   - `checkouts:read`
   - `checkouts:write`
   - `customers:read`
   - `customers:write`
   - **`customer_sessions:write`** (required for the subscription management portal — “Open subscription portal” in the app)
3. Copy the **Access Token** (you won't see it again)

## Step 4: Configure Webhook

1. Go to Settings → Webhooks
2. Create a new webhook:
   - URL: `https://your-domain.com/api/webhooks/polar`
   - Events to subscribe:
     - `subscription.created`
     - `subscription.updated`
     - `subscription.canceled`
     - `subscription.revoked`
     - `checkout.created`
     - `checkout.updated`
3. Copy the **Webhook Secret**

## Step 5: Environment Variables

Add these to your `.env.local` file:

```env
# Polar.sh Configuration
POLAR_ACCESS_TOKEN=polar_at_xxxxxxxxxxxxx
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
POLAR_ORGANIZATION_ID=org_xxxxxxxxxxxxx
POLAR_PREMIUM_PRODUCT_ID=prod_xxxxxxxxxxxxx
POLAR_FREE_PRODUCT_ID=prod_xxxxxxxxxxxxx

# Your site URL (for checkout success/cancel redirects)
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

For the Supabase Edge Functions, add secrets:
```bash
supabase secrets set POLAR_ACCESS_TOKEN=polar_at_xxxxxxxxxxxxx
```

## Step 6: Test Integration

1. Run your development server
2. Sign up as a new user (should default to Free plan)
3. Click "Upgrade to Premium" in the profile menu
4. Complete checkout with Polar test card
5. Verify webhook is received and subscription is updated

## Pricing Summary

| Plan | Price | Listings | Multiplayer |
|------|-------|----------|-------------|
| Free | €0/year | Up to 12 | Solo only |
| Premium | €19.99/year | Unlimited | Full access |

## Multiplayer Rules

- **Only Premium users can invite** others to collaborate (up to 3 collaborators per catalog)
- **Invitees** get full editor access (add and manage listings) in the shared catalog without paying (role: `editor`)
- **Catalog owner** can remove collaborators; **editors** can leave the catalog
- **New users invited**: After signup, they join as editor and can add/manage listings in that catalog
