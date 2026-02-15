import { NextRequest, NextResponse } from 'next/server'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'

type RouteType = 'subway' | 'tram' | 'bus'

function osmRouteTag(routeType: RouteType): string {
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const routeType = (searchParams.get('routeType') || 'subway') as RouteType
  const ref = searchParams.get('ref')
  const lat = parseFloat(searchParams.get('lat') || '45.4642')
  const lon = parseFloat(searchParams.get('lon') || '9.19')
  const radiusM = 50000

  if (!ref || !['subway', 'tram', 'bus'].includes(routeType)) {
    return NextResponse.json({ error: 'Missing or invalid routeType or ref' }, { status: 400 })
  }

  const route = osmRouteTag(routeType)
  const refEscaped = ref.replace(/"/g, '\\"')
  const refRegex =
    routeType === 'subway'
      ? `^${refEscaped}$|^M${refEscaped}$`
      : `^${refEscaped}$`

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
    if (!res.ok) {
      const text = await res.text()
      console.error('Overpass API error:', res.status, text)
      return NextResponse.json({ error: 'Overpass request failed', details: text }, { status: 502 })
    }
    const json = await res.json()
    const elements = json.elements || []
    const ways = elements.filter((el: { type: string }) => el.type === 'way')
    if (ways.length === 0) {
      return NextResponse.json({ type: 'FeatureCollection', features: [] })
    }

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

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
    })
  } catch (err) {
    console.error('Transit route fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch transit route', details: String(err) },
      { status: 500 }
    )
  }
}
