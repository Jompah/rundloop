export interface Landmark {
  id: number
  name: string
  type: LandmarkType
  lat: number
  lng: number
  description?: string  // From OSM tags like description, wikipedia, etc.
  distance?: number     // Distance from route in meters (computed later)
}

export type LandmarkType = 'museum' | 'monument' | 'viewpoint' | 'park' | 'church' | 'historic' | 'artwork' | 'fountain' | 'ruins' | 'castle' | 'landmark'

/**
 * Fetch landmarks near a polyline from Overpass API.
 * Uses a bounding box around the route + buffer, then filters by proximity.
 */
export async function fetchLandmarksNearRoute(
  polyline: [number, number][],  // [lng, lat] pairs
  bufferMeters: number = 300     // Search within 300m of route
): Promise<Landmark[]> {
  // 1. Compute bounding box of polyline with buffer
  const lats = polyline.map(p => p[1])
  const lngs = polyline.map(p => p[0])
  const bufferDeg = bufferMeters / 111320  // rough meters to degrees
  const bbox = {
    south: Math.min(...lats) - bufferDeg,
    north: Math.max(...lats) + bufferDeg,
    west: Math.min(...lngs) - bufferDeg,
    east: Math.max(...lngs) + bufferDeg,
  }

  // 2. Build Overpass QL query for tourism, historic, and leisure POIs
  const query = `
    [out:json][timeout:10];
    (
      node["tourism"~"museum|artwork|viewpoint|attraction|gallery"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["historic"~"monument|memorial|castle|ruins|archaeological_site|building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["amenity"~"place_of_worship|fountain"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["leisure"="park"]["name"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["leisure"="park"]["name"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out center body;
  `

  // 3. Call Overpass API
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  if (!response.ok) {
    console.warn('Overpass API failed:', response.status)
    return []
  }

  const data = await response.json()

  // 4. Parse elements into Landmark objects
  const landmarks: Landmark[] = []
  for (const el of data.elements || []) {
    const name = el.tags?.name
    if (!name) continue  // Skip unnamed POIs

    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (!lat || !lng) continue

    const type = classifyLandmark(el.tags)
    const description = el.tags?.description || el.tags?.['description:en'] || el.tags?.wikipedia || undefined

    landmarks.push({ id: el.id, name, type, lat, lng, description })
  }

  // 5. Filter by actual proximity to polyline (not just bounding box)
  const nearbyLandmarks = landmarks
    .map(lm => ({
      ...lm,
      distance: minDistanceToPolyline(lm.lat, lm.lng, polyline),
    }))
    .filter(lm => lm.distance! <= bufferMeters)
    .sort((a, b) => a.distance! - b.distance!)

  // 6. Deduplicate by name (keep closest)
  const seen = new Set<string>()
  const unique: Landmark[] = []
  for (const lm of nearbyLandmarks) {
    const key = lm.name.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(lm)
    }
  }

  // 7. Limit total markers to avoid cluttered map — prioritize major landmarks
  const typePriority: Record<string, number> = {
    castle: 1, museum: 2, monument: 3, viewpoint: 4, historic: 5,
    church: 6, ruins: 7, park: 8, artwork: 9, fountain: 10, landmark: 11,
  }
  const prioritized = unique
    .sort((a, b) => (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99))
    .slice(0, 6)

  return prioritized
}

function classifyLandmark(tags: Record<string, string>): LandmarkType {
  if (tags.tourism === 'museum') return 'museum'
  if (tags.tourism === 'viewpoint') return 'viewpoint'
  if (tags.tourism === 'artwork') return 'artwork'
  if (tags.tourism === 'attraction' || tags.tourism === 'gallery') return 'landmark'
  if (tags.historic === 'monument' || tags.historic === 'memorial') return 'monument'
  if (tags.historic === 'castle') return 'castle'
  if (tags.historic === 'ruins' || tags.historic === 'archaeological_site') return 'ruins'
  if (tags.historic === 'building') return 'historic'
  if (tags.amenity === 'place_of_worship') return 'church'
  if (tags.amenity === 'fountain') return 'fountain'
  if (tags.leisure === 'park') return 'park'
  return 'landmark'
}

/**
 * Compute the minimum distance from a point to any segment of a polyline.
 */
function minDistanceToPolyline(lat: number, lng: number, polyline: [number, number][]): number {
  let minDist = Infinity
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = pointToSegmentDistance(lat, lng, polyline[i][1], polyline[i][0], polyline[i + 1][1], polyline[i + 1][0])
    if (dist < minDist) minDist = dist
  }
  return minDist
}

/**
 * Distance from point (plat, plng) to line segment (lat1,lng1)-(lat2,lng2) in meters.
 */
function pointToSegmentDistance(
  plat: number, plng: number,
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000  // Earth radius in meters
  const toRad = (d: number) => d * Math.PI / 180

  // Convert to approximate Cartesian (valid for small distances)
  const cosLat = Math.cos(toRad((lat1 + lat2 + plat) / 3))
  const x = (plng - lng1) * cosLat
  const y = plat - lat1
  const dx = (lng2 - lng1) * cosLat
  const dy = lat2 - lat1

  const lenSq = dx * dx + dy * dy
  let t = lenSq > 0 ? ((x * dx + y * dy) / lenSq) : 0
  t = Math.max(0, Math.min(1, t))

  const nearestX = lng1 + t * (lng2 - lng1)
  const nearestY = lat1 + t * (lat2 - lat1)

  const dLat = toRad(plat - nearestY)
  const dLng = toRad(plng - nearestX)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(nearestY)) * Math.cos(toRad(plat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
