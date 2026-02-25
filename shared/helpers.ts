import { COLOR_PALETTE } from './constants'

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
