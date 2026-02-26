import { COLOR_PALETTE } from './constants'
import type { ListingWithMetadata } from './types'

export function getScoreColor(score: number): { bg: string; glow: string } {
  if (score >= 70) {
    return { bg: '#22C55E', glow: 'rgba(34, 197, 94, 0.55)' }
  } else if (score >= 40) {
    return { bg: '#FACC15', glow: 'rgba(250, 204, 21, 0.55)' }
  } else {
    return { bg: '#F87171', glow: 'rgba(248, 113, 113, 0.55)' }
  }
}

export function formatPrice(
  price: number | null | string | undefined,
  isRent: boolean = false,
  currency: string | null = null
): string | null {
  if (!price) return null
  if (typeof price === 'string') {
    if (isRent && !price.includes('/mo')) return `${price}/mo`
    return price
  }

  let currencySymbol = '€'
  let locale = 'it-IT'

  if (currency) {
    switch (currency.toUpperCase()) {
      case 'EUR': currencySymbol = '€'; locale = 'it-IT'; break
      case 'USD': currencySymbol = '$'; locale = 'en-US'; break
      case 'GBP': currencySymbol = '£'; locale = 'en-GB'; break
      case 'CHF': currencySymbol = 'CHF'; locale = 'de-CH'; break
      case 'CAD': currencySymbol = 'C$'; locale = 'en-CA'; break
      case 'AUD': currencySymbol = 'A$'; locale = 'en-AU'; break
      default: currencySymbol = currency; locale = 'en-US'
    }
  }

  const formatted = `${currencySymbol}${price.toLocaleString(locale)}`
  return isRent ? `${formatted}/mo` : formatted
}

export function formatSize(sizeSqm: number | null, sizeUnit: string | null = null): string | null {
  if (!sizeSqm) return null
  if (sizeUnit === 'sqft') {
    const sqft = sizeSqm / 0.092903
    return `${Math.round(sqft)} sq ft`
  }
  return `${Math.round(sizeSqm)} m²`
}

export function isRental(rawContent: string, title: string | null, listingType: string | null | undefined): boolean {
  if (listingType === 'rent') return true
  if (listingType === 'sale') return false

  const content = (rawContent || '').toLowerCase()
  const titleLower = (title || '').toLowerCase()
  const combined = `${content} ${titleLower}`

  const rentalKeywords = ['affitto', 'rent', 'rental', 'noleggio', 'locazione', '/mo', '/mese', 'mensile', 'monthly']
  const saleKeywords = ['vendita', 'sale', 'compravendita', 'acquisto', 'buy']

  if (saleKeywords.some(k => combined.includes(k))) return false
  return rentalKeywords.some(k => combined.includes(k))
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length]
}

export function getListingImages(images: string[] | string | object | null): string[] {
  if (!images) return []
  if (Array.isArray(images)) return images
  if (typeof images === 'string') {
    try { return JSON.parse(images) } catch { return [] }
  }
  if (typeof images === 'object') return Object.values(images) as string[]
  return []
}

export function extractBasicListingInfo(
  listing: Pick<ListingWithMetadata, 'raw_content' | 'title'>
): { price: string | null; address: string | null } {
  const extractPriceFromContent = (content: string): string | null => {
    if (!content) return null
    const priceRegex =
      /€\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)|(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/i
    const match = content.match(priceRegex)
    if (match) {
      return match[0]
    }
    return null
  }

  const price = extractPriceFromContent(listing.raw_content)
  const addressMatch = listing.title?.match(
    /(?:in|a|via|viale|piazza|piazzale)\s+([^,]+)/i
  )
  const address = addressMatch ? addressMatch[1].trim() : null

  return { price, address }
}

export function getWebsiteName(url: string | null | undefined): string {
  if (!url) return 'original website'
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    const cleanHostname = hostname.replace(/^www\./, '')
    const multiPartTlds = [
      'co.uk', 'com.au', 'co.za', 'co.nz', 'com.br', 'com.mx',
      'co.jp', 'com.cn', 'com.hk', 'co.in', 'com.sg', 'com.my',
      'co.th', 'com.vn', 'com.ph', 'co.id', 'com.tr', 'co.kr',
    ]
    let domainParts: string[] = []
    let foundMultiPartTld = false
    for (const tld of multiPartTlds) {
      if (cleanHostname.endsWith('.' + tld)) {
        const withoutTld = cleanHostname.slice(0, -(tld.length + 1))
        domainParts = withoutTld.split('.')
        domainParts.push(tld)
        foundMultiPartTld = true
        break
      }
    }
    if (!foundMultiPartTld) {
      domainParts = cleanHostname.split('.')
    }
    if (domainParts.length >= 2) {
      const domainName = domainParts[domainParts.length - 2]
      const tld = domainParts[domainParts.length - 1]
      const capitalizedDomain = domainName.charAt(0).toUpperCase() + domainName.slice(1)
      return `${capitalizedDomain}.${tld}`
    }
    return cleanHostname.charAt(0).toUpperCase() + cleanHostname.slice(1)
  } catch {
    return 'original website'
  }
}
