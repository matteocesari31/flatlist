/**
 * Parse dream apartment (or any) text for a mentioned public transport line.
 * Returns the first match: route type (subway/tram/bus) and line ref (e.g. "2", "14").
 */
export type TransitRouteType = 'subway' | 'tram' | 'bus'

export interface ParsedTransitLine {
  routeType: TransitRouteType
  ref: string
}

const SUBWAY_PATTERNS = [
  /\b(?:metro|metrò|metropolitana|subway|linea?\s+metro)\s*[:\s]*(\d+)\b/i,
  /\b(?:metro|metrò|metropolitana)\s+[mM]?\s*(\d+)\b/i, // "metro m4", "metro M4", "metro 4"
  /\b[mM](\d+)\b/, // "m4", "M4", "m14"
  /\b(?:linea?\s+)?(\d+)\s*(?:della\s+)?metropolitana\b/i,
]

const TRAM_PATTERNS = [
  /\btram\s*[:\s]*(\d+)\b/i,
  /\b(?:linea?\s+)?(\d+)\s*(?:del\s+)?tram\b/i,
]

const BUS_PATTERNS = [
  /\bbus\s*[:\s]*(\d+)\b/i,
  /\b(?:linea?\s+)?(\d+)\s*(?:del\s+)?bus\b/i,
  /\bautobus\s*[:\s]*(\d+)\b/i,
]

export function parseTransitLineFromText(text: string | null | undefined): ParsedTransitLine | null {
  if (!text || typeof text !== 'string') return null
  const t = text.trim()
  if (!t.length) return null

  for (const re of SUBWAY_PATTERNS) {
    const m = t.match(re)
    if (m) return { routeType: 'subway', ref: m[1]! }
  }
  for (const re of TRAM_PATTERNS) {
    const m = t.match(re)
    if (m) return { routeType: 'tram', ref: m[1]! }
  }
  for (const re of BUS_PATTERNS) {
    const m = t.match(re)
    if (m) return { routeType: 'bus', ref: m[1]! }
  }
  return null
}

/**
 * Fetch transit route geometry via our API (proxies Overpass) to avoid CORS and improve reliability.
 * bbox: [minLng, minLat, maxLng, maxLat] (optional); used to compute center for the Overpass area query.
 */
export async function fetchTransitRouteGeometry(
  routeType: TransitRouteType,
  ref: string,
  bbox?: [number, number, number, number]
): Promise<GeoJSON.FeatureCollection | null> {
  const lat = bbox ? (bbox[1] + bbox[3]) / 2 : 45.4642
  const lon = bbox ? (bbox[0] + bbox[2]) / 2 : 9.19
  const params = new URLSearchParams({
    routeType,
    ref,
    lat: String(lat),
    lon: String(lon),
  })
  try {
    const res = await fetch(`/api/transit-route?${params}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.features?.length === 0) return null
    return json as GeoJSON.FeatureCollection
  } catch {
    return null
  }
}
