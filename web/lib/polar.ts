import { Polar } from '@polar-sh/sdk'

// Initialize Polar client (server-side only)
export function createPolarClient() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('POLAR_ACCESS_TOKEN environment variable is not set')
  }
  
  return new Polar({
    accessToken,
  })
}

// Get the Premium product ID
export function getPremiumProductId(): string {
  const productId = process.env.POLAR_PREMIUM_PRODUCT_ID
  if (!productId) {
    throw new Error('POLAR_PREMIUM_PRODUCT_ID environment variable is not set')
  }
  return productId
}

// Get the Organization ID
export function getOrganizationId(): string {
  const orgId = process.env.POLAR_ORGANIZATION_ID
  if (!orgId) {
    throw new Error('POLAR_ORGANIZATION_ID environment variable is not set')
  }
  return orgId
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Polar uses a simple HMAC-SHA256 signature
  // The signature header is in the format: sha256=<signature>
  const crypto = require('crypto')
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  const providedSignature = signature.replace('sha256=', '')
  
  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    )
  } catch {
    return false
  }
}

// Subscription event types from Polar webhooks
export type PolarWebhookEvent = 
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.revoked'
  | 'checkout.created'
  | 'checkout.updated'

export interface PolarSubscriptionData {
  id: string
  status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
  customer_id: string
  product_id: string
  price_id: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  started_at: string
  ended_at: string | null
  customer: {
    id: string
    email: string
    name: string | null
    metadata: Record<string, string>
  }
}

export interface PolarCheckoutData {
  id: string
  status: 'open' | 'expired' | 'confirmed' | 'succeeded'
  url: string
  customer_id: string | null
  customer_email: string | null
  product_id: string
  success_url: string
  metadata: Record<string, string>
}

export interface PolarWebhookPayload {
  type: PolarWebhookEvent
  data: PolarSubscriptionData | PolarCheckoutData
}

// Helper to determine if subscription is active
export function isSubscriptionActive(status: string): boolean {
  return ['active', 'trialing'].includes(status)
}

// Create a checkout session for Premium subscription
export async function createCheckoutSession(
  customerEmail: string,
  userId: string,
  successUrl: string,
  returnUrl?: string
): Promise<{ checkoutUrl: string; checkoutId: string }> {
  const polar = createPolarClient()
  const productId = getPremiumProductId()
  
  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl,
    returnUrl,
    customerEmail,
    metadata: {
      user_id: userId,
    },
  })
  
  return {
    checkoutUrl: checkout.url,
    checkoutId: checkout.id,
  }
}

// Get customer portal URL for managing subscription
export async function getCustomerPortalUrl(
  customerId: string
): Promise<string | null> {
  try {
    const polar = createPolarClient()
    const session = await polar.customerSessions.create({
      customerId,
    })
    return session.customerPortalUrl
  } catch (error) {
    console.error('Error getting customer portal URL:', error)
    return null
  }
}

// Polar SDK list() returns an async iterable; consume first page and get items
async function firstPageItems(list: unknown): Promise<unknown[]> {
  const anyList = list as { result?: { items?: unknown[] }; items?: unknown[]; [Symbol.asyncIterator]?: () => AsyncIterator<unknown> }
  if (typeof anyList?.[Symbol.asyncIterator] === 'function') {
    for await (const page of anyList as AsyncIterable<{ result?: { items?: unknown[] }; items?: unknown[] }>) {
      const items = page?.items ?? page?.result?.items
      return Array.isArray(items) ? items : []
    }
    return []
  }
  const items = anyList?.result?.items ?? anyList?.items
  return Array.isArray(items) ? items : []
}

// Find Polar customer ID by email (for subscription sync)
export async function findCustomerIdByEmail(
  customerEmail: string
): Promise<string | null> {
  try {
    const polar = createPolarClient()
    const orgId = getOrganizationId()
    const listResult = await polar.customers.list({
      organizationId: orgId,
      email: customerEmail,
      limit: 1,
    })
    const items = await firstPageItems(listResult)
    const customer = items[0] as { id?: string } | undefined
    return customer?.id ?? null
  } catch (error) {
    console.error('Error finding Polar customer by email:', error)
    return null
  }
}

// List subscriptions for a Polar customer and return the active one if any (includes trialing)
export async function getActiveSubscriptionForCustomer(
  customerId: string
): Promise<{
  id: string
  status: string
  current_period_end: string | null
} | null> {
  try {
    const polar = createPolarClient()
    const orgId = getOrganizationId()
    const productId = getPremiumProductId()
    // Don't filter by active: true so we include trialing subscriptions
    const listResult = await polar.subscriptions.list({
      organizationId: orgId,
      customerId: [customerId],
      productId: [productId],
      limit: 10,
    })
    const items = await firstPageItems(listResult) as Array<{ id: string; status: string; current_period_end?: string | null; currentPeriodEnd?: string | null }>
    const sub = items[0]
    if (!sub) return null
    const active = isSubscriptionActive(String(sub.status))
    if (!active) return null
    const periodEnd = sub.current_period_end ?? sub.currentPeriodEnd ?? null
    return {
      id: sub.id,
      status: String(sub.status),
      current_period_end: periodEnd,
    }
  } catch (error) {
    console.error('Error listing Polar subscriptions:', error)
    return null
  }
}
