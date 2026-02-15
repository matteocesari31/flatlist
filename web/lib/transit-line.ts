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
  /\bM(\d)\b/,
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

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'

/**
 * Map OSM route type to Overpass route= value.
 */
function osmRouteTag(routeType: TransitRouteType): string {
  switch (routeType) {
    case 'subway':
      return 'subway'
    case 'tram':
      return 'tram'
    case 'bus':
      return 'bus'
    default:
      return 'subway'
  }
}

/**
 * Fetch transit route geometry from OpenStreetMap via Overpass.
 * bbox: [minLng, minLat, maxLng, maxLat] (optional); if not provided uses a large area around Milan.
 */
export async function fetchTransitRouteGeometry(
  routeType: TransitRouteType,
  ref: string,
  bbox?: [number, number, number, number]
): Promise<GeoJSON.FeatureCollection | null> {
  const route = osmRouteTag(routeType)
  // Ref can be "2" or "M2" etc.; Overpass often has ref as "2" or "M2" for metro
  const refEscaped = ref.replace(/"/g, '\\"')
  const refRegex =
    routeType === 'subway'
      ? `^${refEscaped}$|^M${refEscaped}$`
      : `^${refEscaped}$`

  const lat = bbox ? (bbox[1] + bbox[3]) / 2 : 45.4642
  const lon = bbox ? (bbox[0] + bbox[2]) / 2 : 9.19
  const radiusM = 50000

  // Query: relation with route type and ref, then get member ways with geometry
  const query = `
[out:json][timeout:15];
(
  relation["type"="route"]["route"="${route}"](around:${radiusM},${lat},${lon})["ref"~"${refRegex}"];
)->.r;
way(r);
out geom;
`
  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    })
    if (!res.ok) return null
    const json = await res.json()
    const elements = json.elements || []
    const ways = elements.filter((el: { type: string }) => el.type === 'way')
    if (ways.length === 0) return null

    const features: GeoJSON.Feature<GeoJSON.LineString>[] = []
    for (const way of ways) {
      const geom = way.geometry
      if (!Array.isArray(geom) || geom.length < 2) continue
      const coordinates = geom
        .filter((n: { lon?: number; lat?: number }) => n.lon != null && n.lat != null)
        .map((n: { lon: number; lat: number }) => [n.lon, n.lat] as [number, number])
      if (coordinates.length >= 2) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        })
      }
    }
    if (features.length === 0) return null

    return {
      type: 'FeatureCollection',
      features,
    }
  } catch {
    return null
  }
}
