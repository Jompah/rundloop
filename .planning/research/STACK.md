# Technology Stack

**Project:** RundLoop v1.1 — Route Quality & Map UX
**Researched:** 2026-03-21
**Mode:** Subsequent milestone — existing stack is validated, focus on NEW capabilities only

## Existing Stack (Validated, Do Not Re-Research)

| Technology | Purpose | Status |
|------------|---------|--------|
| Next.js 16.2 | App framework | Production |
| React 19 | UI library | Production |
| TypeScript 5.x | Type safety | Production |
| Tailwind CSS 4.x | Styling | Production |
| MapLibre GL JS 5.20 | Map rendering | Production |
| OSRM (public foot endpoint) | Road routing | Production |
| Claude Haiku API | AI waypoint generation | Production |
| IndexedDB (idb-keyval) | Client-side persistence | Production |
| Motion 12.x | Animations | Production |
| @turf/* (tree-shaken) | Geospatial calculations | Production |
| Service Worker | Offline PWA support | Production |
| Web Speech API | Voice navigation | Production |
| Geolocation API | GPS tracking | Production |

## New Stack Additions for v1.1

### 1. OpenStreetMap Overpass API — POI Data for Nature Mode

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Overpass API (public endpoint) | v0.7.62+ | Query parks, water features, green spaces near user GPS | Claude Haiku's training data knows famous landmarks but cannot reliably identify which specific parks, trails, and water features exist within 2km of an arbitrary coordinate. Nature mode needs real POI locations to generate waypoints through actual green spaces, not hallucinated ones. |

**Why Overpass and not alternatives:**

| Alternative | Why Not |
|-------------|---------|
| Google Places API | Paid per request ($17/1000 calls), requires API key, adds billing dependency to a free-to-run app. POI categories skew commercial (restaurants, shops), not green spaces. |
| Foursquare / Yelp APIs | Commercial POIs irrelevant for running through nature. No park/trail/waterway coverage. |
| Claude-only (no POI data) | Claude knows "Stockholm has Djurgarden" but cannot tell you which of the 30+ small parks are within 1.5km of a specific GPS coordinate. Nature mode quality depends on coordinate-precise POI awareness. Explore mode (landmarks) works fine with Claude-only since famous sites are in training data. |
| Static GeoJSON datasets | Stale, large bundle size, incomplete coverage outside major cities, no way to update. |
| Mapbox Geocoding / Tilequery | Would work but adds a paid dependency. Overpass covers the same OSM data for free. |

**Integration approach:** Next.js API route (`/api/pois`) fetches from Overpass, caches results in server memory (1-hour TTL per ~1km grid cell), returns filtered POI centroids to client. This avoids CORS issues, rate limit concerns, and keeps the Overpass query server-side.

**How POIs feed into route generation (Nature mode only):**

```
1. User selects Nature mode + taps Generate
2. Client calls /api/pois?lat=X&lng=Y&radius=R&mode=nature
3. Server queries Overpass for parks/water/green within radius
4. Server returns [{lat, lng, type, name?}, ...] (max 20 POIs)
5. Client passes POI list to route-ai.ts as prompt context
6. Claude prompt includes: "Route THROUGH or NEAR these green spaces: [POI list with coordinates]"
7. Claude generates waypoints biased toward real green spaces
8. Same pipeline: waypoints -> binary search -> OSRM -> render
```

For **Explore mode**: Claude-only (no Overpass). Claude's training data reliably knows famous landmarks, viewpoints, historic sites. Enriching with Overpass data adds latency for marginal gain since `tourism=viewpoint` and `historic=monument` coverage in OSM varies widely by city.

**Fallback**: If Overpass is down, slow (>3s), or returns zero POIs: fall back to Claude-only prompt (same as explore mode). Route generation must never block on POI fetch failure.

### 2. No New npm Dependencies Required

The v1.1 features require zero new npm packages. Every capability is achievable with the existing stack plus the Overpass API via raw `fetch()`.

| Feature | Implementation | Why No New Dep |
|---------|---------------|----------------|
| Overpass API queries | Raw `fetch()` in Next.js API route | Simple HTTP POST with Overpass QL body, returns JSON. No SDK exists worth using. |
| POI-aware waypoint generation | Extend existing `route-ai.ts` prompt with POI context | Pure string composition. Already doing this with `ROUTE_PROMPT`. |
| Map auto-center on GPS | `map.flyTo()` + existing `watchPosition` | Both APIs already available. Wire on component mount. |
| "Center on me" button | `map.flyTo(userLocation)` on click | MapLibre method, already available. |
| Route mode toggle UI | React state + Tailwind | Existing stack handles this trivially. |
| Flexible start point (300m) | Haversine offset + OSRM `nearest` service | Pure math (already in codebase). OSRM nearest is same public endpoint. |
| Start point validation | Haversine distance check, vector clamping | 10 lines of TypeScript geometry. |
| iOS Safari fixes | CSS/JS debugging | No dependencies. |

## Overpass API Technical Details

### OSM Tags by Route Mode

**Nature Mode** — parks, waterfronts, green corridors, trails:

| Tag | Type | What It Finds |
|-----|------|---------------|
| `leisure=park` | way | City parks, neighborhood parks |
| `leisure=garden` | way | Botanical gardens, public gardens |
| `leisure=nature_reserve` | way/relation | Nature reserves, protected areas |
| `landuse=forest` | way | Forested areas |
| `landuse=meadow` | way | Open meadows, grasslands |
| `natural=water` | way | Lakes, ponds |
| `natural=wood` | way | Woodland |
| `natural=beach` | node/way | Beaches |
| `waterway=river` | way | Rivers |
| `waterway=stream` | way | Streams, creeks |
| `waterway=canal` | way | Canals |

**Explore Mode** — uses Claude-only (no Overpass), but for reference these are the relevant OSM tags if needed later:

| Tag | What It Finds |
|-----|---------------|
| `tourism=viewpoint` | Scenic viewpoints |
| `tourism=attraction` | Tourist attractions |
| `tourism=museum` | Museums |
| `historic=monument` | Monuments, memorials |
| `historic=castle` | Castles, fortifications |
| `amenity=place_of_worship` | Cathedrals, churches (as landmarks) |

### Example Overpass Query (Nature Mode)

```
[out:json][timeout:10];
(
  way["leisure"="park"](around:2000,59.33,18.07);
  way["leisure"="garden"](around:2000,59.33,18.07);
  way["leisure"="nature_reserve"](around:2000,59.33,18.07);
  way["natural"="water"](around:2000,59.33,18.07);
  way["waterway"](around:2000,59.33,18.07);
  way["landuse"="forest"](around:2000,59.33,18.07);
  way["natural"="wood"](around:2000,59.33,18.07);
);
out center;
```

- `around:RADIUS,LAT,LNG` searches within RADIUS meters of a coordinate
- `out center;` returns centroids for ways/relations (one lat/lng per POI, not full geometry)
- `[timeout:10]` prevents hanging (our queries are small, typical response < 1s)
- Query ways only (not nodes) because parks/forests/water are always mapped as areas in OSM

### Search Radius Strategy

| Route Distance | Search Radius | Rationale |
|---------------|---------------|-----------|
| < 5 km | 1500m | Short routes stay close to start |
| 5-10 km | 2500m | Medium routes spread further |
| 10-21 km | 4000m | Long routes need wider POI search |

Formula: `Math.min(4000, Math.max(1500, distanceKm * 350))` meters.

### Rate Limits and Caching

| Concern | Detail | Mitigation |
|---------|--------|------------|
| Rate limit | ~2 concurrent requests per IP on public endpoint | Server-side caching eliminates most repeat queries |
| Timeout | Default 180s, we set 10s | Our radius queries are small and fast |
| Availability | Multiple public endpoints exist | Primary: `overpass-api.de`, fallback: `overpass.kumi.systems` |
| Caching | POIs rarely change | Cache per grid cell (round lat/lng to 2 decimals = ~1km grid), 1-hour TTL, simple `Map<string, {data, timestamp}>` in server memory |
| Failure | Overpass down or slow | Fall back to Claude-only prompt (explore mode behavior). Never block route generation on POI failure. |

### OSRM `nearest` Service (for Flexible Start Point)

The existing OSRM public endpoint supports a `nearest` service at the same base URL:

```
GET https://router.project-osrm.org/nearest/v1/foot/{lng},{lat}?number=1
```

Returns the nearest walkable road/path point. Used for flexible start:
1. Generate random point within 300m of GPS (random bearing + haversine offset)
2. Snap to nearest walkable road via OSRM `nearest`
3. Use snapped point as route start/end

No new dependency — same endpoint already in `route-osrm.ts`.

**Confidence on `nearest` service availability:** MEDIUM — need to verify the public OSRM endpoint exposes this service (it is part of the OSRM API spec but public endpoints may restrict it). Test during implementation; if unavailable, skip the snap step and use the raw offset point (OSRM `route` will snap waypoints anyway).

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| `@turf/turf` (full bundle) | Already using tree-shaken @turf/* packages from v1.0. Do NOT import the full bundle (200KB+). |
| Google Places API | Paid, overkill. Overpass covers nature POIs for free. |
| GraphHopper / OpenRouteService | Would replace OSRM. No reason to switch mid-milestone. |
| PostGIS / spatial database | Server-side POI filtering is simple radius math. No spatial DB needed. |
| `overpass-ts` or npm wrappers | Thin wrappers adding dependency risk for zero value. Raw `fetch()` is cleaner. |
| Any state management library | Route mode is a simple React state toggle. `useState` + prop drilling to 2 components. |
| Mapbox Geocoding API | Adds paid dependency for start point resolution. OSRM `nearest` + haversine offset covers this. |
| OpenRouteService POI API | Adds another external service. Overpass alone is sufficient. |

## Installation

```bash
# No new packages to install.
# v1.1 uses the existing stack + Overpass API via raw fetch().
```

## API Endpoint Summary (New for v1.1)

| Endpoint | Method | Purpose | External Dependency |
|----------|--------|---------|---------------------|
| `/api/pois` | GET | Fetch nearby POIs from Overpass for nature mode | `overpass-api.de` |
| `router.project-osrm.org/nearest/v1/foot/` | GET | Snap flexible start point to nearest road | OSRM (existing) |

Both are free, no API keys required.

## Confidence Assessment

| Claim | Confidence | Source |
|-------|-----------|--------|
| Overpass API is free, no API key needed | HIGH | [Overpass API Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) |
| `around:` radius filter syntax works for coordinate queries | HIGH | [Overpass QL docs](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL), [Overpass Polygon/Around docs](https://dev.overpass-api.de/overpass-doc/en/full_data/polygon.html) |
| OSM tags for parks, water, forests are well-established | HIGH | [OSM Key:leisure](https://wiki.openstreetmap.org/wiki/Key:leisure), [OSM Key:natural](https://wiki.openstreetmap.org/wiki/Key:natural) |
| `out center;` returns centroids for ways | HIGH | [Overpass API by Example](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example) |
| OSRM `nearest` service on public endpoint | MEDIUM | Part of OSRM API spec; verify public endpoint exposes it |
| No new npm deps needed | HIGH | Direct analysis of existing codebase and feature requirements |
| Overpass rate limits (~2 concurrent per IP) | MEDIUM | [GitHub issue discussion](https://github.com/drolbr/Overpass-API/issues/333), [Overpass commons docs](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) |
| Claude knows famous landmarks but not precise small-park locations | MEDIUM | Inferred from LLM training data patterns; needs empirical validation |
| Trail Router uses OSM green features for scenic waypoints | HIGH | [How Trail Router Works](https://trailrouter.com/blog/how-trail-router-works/) |

## Sources

- [Overpass API - OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) — core API documentation
- [Overpass API by Example](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example) — query patterns
- [Overpass QL Reference](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) — query language syntax
- [Overpass Around/Polygon](https://dev.overpass-api.de/overpass-doc/en/full_data/polygon.html) — radius search documentation
- [Overpass Rate Limiting](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) — usage policy and limits
- [Key:leisure - OSM Wiki](https://wiki.openstreetmap.org/wiki/Key:leisure) — park, garden, nature_reserve tags
- [Key:tourism - OSM Wiki](https://wiki.openstreetmap.org/wiki/Key:tourism) — viewpoint, attraction, museum tags
- [Tag:tourism=viewpoint - OSM Wiki](https://wiki.openstreetmap.org/wiki/Tag:tourism=viewpoint) — viewpoint tag usage
- [How Trail Router Works](https://trailrouter.com/blog/how-trail-router-works/) — OSM-based scenic routing approach (green index, perimeter waypoints)
- [Pleasant Pedestrian Routes (MDPI Sensors)](https://www.mdpi.com/1424-8220/18/11/3794) — academic research on scenic route generation
- [ScenicPlanner (Springer)](https://link.springer.com/article/10.1007/s11704-016-5550-2) — scenic route planning with heterogeneous POI data
- [Overpass rate limit issues (GitHub)](https://github.com/drolbr/Overpass-API/issues/333) — rate limiting behavior

---
*Stack research for: RundLoop v1.1 — scenic route modes, POI integration, map UX*
*Researched: 2026-03-21*
