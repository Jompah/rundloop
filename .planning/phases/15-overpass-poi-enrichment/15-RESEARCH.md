# Phase 15: Overpass POI Enrichment - Research

**Researched:** 2026-03-24
**Status:** Complete

## Current Architecture

### Overpass Usage
- `src/lib/overpass.ts` has `fetchLandmarksNearRoute()` which fetches POIs AFTER route generation for display
- Called in `page.tsx` after route is generated: `fetchLandmarksNearRoute(generatedRoute.polyline)`
- Queries the public Overpass API (`https://overpass-api.de/api/interpreter`)
- Returns `Landmark[]` with name, type, lat, lng
- Currently fetches tourism, historic, amenity, and leisure=park POIs

### Nature Mode Waypoints
- Currently, Nature mode relies entirely on the AI prompt to generate "green" waypoints
- The AI invents coordinates based on its knowledge of the city
- These can be inaccurate or hallucinated

### No Server-Side Infrastructure
- No API routes exist in the Next.js app
- All calls are client-side

## Design Decisions

### POI-Enhanced Waypoint Generation
For Nature mode, the flow becomes:
1. Fetch green-space POIs from Overpass around the user's position
2. If >= 2 POIs found: inject their real coordinates into the AI prompt as "must-visit" waypoints
3. If < 2 POIs or Overpass fails: fall back to standard AI-only generation

### Server-Side Cache via Next.js API Route
Create `src/app/api/pois/route.ts`:
- Accepts `lat`, `lng`, `radius` query params
- Computes a grid cell key (~1km resolution: `Math.floor(lat*100)/100, Math.floor(lng*100)/100`)
- Checks in-memory cache (Map with TTL)
- If cache miss: queries Overpass for nature POIs
- Returns JSON array of POIs
- 1-hour TTL per grid cell

### Overpass Query for Nature POIs
Focus on green/nature features:
- `leisure=park`, `leisure=garden`, `leisure=nature_reserve`
- `natural=water`, `natural=wood`, `natural=beach`
- `waterway=river`, `waterway=canal`, `waterway=stream`
- `landuse=forest`, `landuse=recreation_ground`

### Integration with Route Generation
In `page.tsx`, when `scenicMode === 'nature'` and `routeMode === 'ai'`:
1. Call the POI API route before generating AI waypoints
2. If POIs returned: pass them to a modified prompt that includes "route through these real locations"
3. The AI still generates the full waypoint set but is guided by real POI coordinates

### Fallback Strategy
- Overpass timeout/failure: catch error, continue with AI-only generation
- < 2 POIs: use AI-only generation
- Show user feedback toast when falling back: "Inga parker hittades i narheten - visar standardrutt"

## Files to Create/Modify
- `src/app/api/pois/route.ts` - NEW: server-side cached POI endpoint
- `src/lib/overpass.ts` - Add `fetchNaturePOIs` function for client-side fallback
- `src/lib/route-ai.ts` - Update `buildRoutePrompt` to accept optional POI waypoints
- `src/app/page.tsx` - Wire POI fetch into Nature mode route generation
