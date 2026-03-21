# Feature Landscape

**Domain:** Scenic route generation, POI-based explore routes, map GPS centering, flexible start points for a running PWA
**Researched:** 2026-03-21
**Milestone:** v1.1 Route Quality & Map UX
**Existing system:** RundLoop v1.0 with AI (Claude Haiku) + algorithmic route generation, OSRM foot-routing, MapLibre GL JS map, GPS tracking, voice nav, run history, saved routes, PWA

## Table Stakes

Features users expect when an app offers "scenic" or "explore" route modes. Missing = feature feels half-baked.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Map centers on GPS on app open** | Every map app does this (Google Maps, Apple Maps, Strava, Komoot). Stockholm hardcoded default is jarring for non-Stockholm users. | Low | Geolocation API (already used) | Request position once on mount, `map.flyTo()`. Must handle permission denied gracefully (keep current default). |
| **"Center on me" button** | Standard crosshair/location icon in bottom-right. Users pan the map to explore, then need a one-tap way back. Google Maps, OsmAnd, Gaia GPS all have this. | Low | MapLibre map ref, GPS position | Show after user pans away from their location. Hide when already centered. Three-state pattern (off/centered/heading-locked) is ideal but centered-only is acceptable for v1.1. |
| **Nature mode biases toward parks/green/water** | TrailRouter's entire value prop. Strava's "popularity" routing is the closest mainstream equivalent. Users selecting "Nature" expect visibly greener routes. | Medium | AI prompt modification (simple) or Overpass API POI fetch + waypoint biasing (better) | AI-only approach: modify prompt to emphasize parks, waterfronts, trails. POI-enriched approach: query Overpass for `leisure=park`, `natural=water`, `landuse=forest` near start, inject as waypoint hints. |
| **Explore mode surfaces landmarks/viewpoints** | Komoot "Highlights" pattern. Users selecting "Explore" expect routes passing notable places. | Medium | AI prompt modification or Overpass API for `tourism=viewpoint`, `tourism=attraction`, `historic=monument` | Same two-tier approach as Nature mode. AI prompt is quick win; Overpass enrichment makes it genuinely useful. |
| **Route mode toggle in UI** | Clear visual selector showing current mode. Must be obvious which mode is active before generating. | Low | UI component only | Segmented control or pill toggle: "Standard" / "Nature" / "Explore". Place above or below distance selector in RouteGenerator panel. |
| **Flexible start point (within 300m)** | plotaroute, Ride with GPS, and Komoot all allow moving start point. Runners may want to start from a nearby park entrance rather than their exact GPS position. | Medium | Map interaction (tap-to-set) or automatic snap to nearest trail/park entrance | Two approaches: (1) tap-on-map to move start pin within 300m radius, or (2) algorithmic: when Nature mode is active, auto-snap start to nearest park entrance within 300m. Option 1 is more flexible and expected. |

## Differentiators

Features that set RundLoop apart. Not expected in v1.1, but high value if included.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Overpass API POI-enriched waypoints** | Instead of relying solely on AI "knowing" where parks are (hallucination risk), fetch real POI coordinates from OSM and inject them as waypoint candidates. This makes Nature/Explore modes genuinely data-driven rather than prompt-dependent. | Medium-High | Overpass API integration, waypoint scoring/selection logic | TrailRouter uses this approach (pre-computed green index from OSM polygon intersections). RundLoop can do a lighter version: query Overpass at route-generation time for POIs within a radius, score and select 2-4 as waypoints, pass to OSRM. |
| **POI labels on map** | Show what scenic/explore points the route passes (park name, viewpoint name, landmark). Komoot does this with "Highlights" dots. | Low-Medium | POI data from Overpass response, MapLibre markers/popups | Add `label` field to `RouteWaypoint` (already has optional `label`). Display as small chips on map near waypoints. |
| **Route preview with POI chips** | Before starting run, show a card listing POIs the route passes: "Passes: Humlegarden, Strandvagen waterfront, Djurgarden entrance". | Low | POI data, UI component | Builds confidence in the route quality. Simple list below route stats. |
| **Nature "green score"** | Rate how green a route is (percentage of route near parks/water). TrailRouter's "green index" concept. | High | Route geometry + OSM polygon intersection calculation | Requires spatial analysis. Could approximate by checking what fraction of OSRM route coordinates fall within Overpass-returned park/water polygons. Defer unless Overpass integration is already done. |
| **Multi-mode route regeneration** | "Try again" that generates a different route in the same mode. Already have retry logic for waypoint convergence. | Low | Existing retry infrastructure | Add randomization seed or rotation offset to avoid regenerating the same route. Algorithmic mode already has random rotation. |

## Anti-Features

Features to explicitly NOT build for v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full Overpass-based routing engine (like TrailRouter)** | TrailRouter pre-processes the entire planet's OSM data into a custom routing engine with green-weighted edges. This is a multi-month infrastructure project requiring PostGIS, custom OSRM profiles, and planetary data imports. Completely disproportionate for v1.1. | Use Overpass API for POI discovery only. Keep OSRM as the routing engine. Bias routes by choosing waypoints near green/explore POIs, not by modifying edge weights. |
| **User-drawn custom routes** | Some apps (Strava, Ride with GPS) let users draw routes point-by-point on the map. This is a full route editor, not a route generator. Contradicts RundLoop's core value of "generate and go". | Keep tap-to-set-start-point (single interaction). Route shape is always generated, never drawn. |
| **Real-time POI data (opening hours, reviews, photos)** | Google Places API territory. Expensive, complex, not what runners need mid-run. | Show POI names only. No live data. OSM static tags are sufficient. |
| **Community heatmap routing** | Strava's signature feature. Requires massive activity dataset RundLoop doesn't have. | AI mode already asks for "interesting" routes. Overpass POI approach achieves similar "known good places" effect without user data. |
| **Multiple route alternatives side-by-side** | Showing 3 route options like Google Maps directions. Adds UI complexity and 3x API calls. | Generate one route at a time. "Try again" button for alternatives. Existing UX pattern works. |
| **Terrain/surface preference toggles** | Trail vs paved, flat vs hilly preferences. Requires OSRM profile customization or elevation-aware waypoint selection. | Defer to v1.2+. The existing elevation gradient visualization already shows what runners will encounter. |

## Feature Dependencies

```
GPS auto-center on open --> "Center on me" button (shared GPS state management)
Route mode toggle UI --> Nature mode AI prompt changes (mode must exist before it's used)
Route mode toggle UI --> Explore mode AI prompt changes
Nature mode (AI prompt) --> Overpass POI enrichment for Nature (enhancement, not blocker)
Explore mode (AI prompt) --> Overpass POI enrichment for Explore (enhancement, not blocker)
Overpass POI integration --> POI labels on map (need data before display)
Overpass POI integration --> Route preview with POI chips
Flexible start point --> Route mode toggle (start point may snap to park entrance in Nature mode)
iOS GPS permission fix --> GPS auto-center on open (auto-center depends on permission being granted)
iOS layout fix --> "Center on me" button (avoid compounding layout issues)
```

## Implementation Strategy: Two-Tier Approach for Route Modes

### Tier 1: AI Prompt Modification (Quick Win, Ship First)

Modify the existing `ROUTE_PROMPT` in `route-ai.ts` to accept a `routeMode` parameter. The current prompt already says "Prefer parks, waterfront paths, pedestrian areas" -- this needs to become mode-conditional:

- **Standard mode (current behavior):** Keep existing balanced prompt.
- **Nature mode prompt additions:** "Strongly prefer routes through parks, along waterfronts, through forests, and along green corridors. Avoid commercial districts and industrial areas. Prioritize paths adjacent to green spaces, nature reserves, and water features. At least half the waypoints should be within or adjacent to parks or natural areas."
- **Explore mode prompt additions:** "Route through areas with landmarks, viewpoints, historic monuments, notable architecture, and touristy points of interest. Prefer routes that pass by at least 2-3 notable sights. Include the name of each notable place as a label on the waypoint."

This works because Claude Haiku has geographic knowledge of major cities. For algorithmic mode, route modes would be unavailable (algorithmic generates geometric patterns with no semantic awareness -- show a note to users that scenic modes require AI mode).

**Confidence:** MEDIUM -- AI will produce directionally correct results for well-known cities but may hallucinate POIs in less-known areas.

### Tier 2: Overpass API POI Enrichment (Better Quality, Phase 2 of v1.1)

1. Query Overpass API for relevant POIs within ~2km of start point
2. Score and select 2-4 POIs as waypoint candidates based on distance and distribution
3. Inject POI coordinates into the waypoint array before OSRM routing
4. OSRM snaps to real roads, producing a route that passes through/near these POIs

**Nature OSM tags to query:**
- `leisure=park`, `leisure=garden`, `leisure=nature_reserve`
- `natural=water`, `natural=wood`, `natural=beach`
- `landuse=forest`, `landuse=meadow`
- `waterway=river`, `waterway=stream`

**Explore OSM tags to query:**
- `tourism=viewpoint`, `tourism=attraction`, `tourism=museum`
- `historic=monument`, `historic=memorial`, `historic=castle`
- `amenity=place_of_worship` (cathedrals, churches as landmarks)
- `tourism=artwork` (public art installations)

**Overpass query example (Nature mode, 2km radius):**
```
[out:json][timeout:10];
(
  way["leisure"="park"](around:2000,{lat},{lng});
  way["natural"="water"](around:2000,{lat},{lng});
  way["landuse"="forest"](around:2000,{lat},{lng});
  node["leisure"="garden"](around:2000,{lat},{lng});
);
out center;
```

**Confidence:** HIGH -- Overpass API is well-documented, free, rate-limited but sufficient for per-route queries. This approach is validated by TrailRouter's success.

## Map Centering: Expected Behavior

### Auto-center on app open
1. Request `navigator.geolocation.getCurrentPosition()` on mount
2. On success: `map.flyTo({ center: [lng, lat], zoom: 14 })`
3. On error/denied: keep current default center (Stockholm or last known position from IndexedDB)
4. Show subtle loading indicator while acquiring position
5. Store last known position in IndexedDB for faster initial center on next app open

### "Center on me" button
1. **Position:** bottom-right of map, above attribution, standard crosshair/location icon
2. **Visibility:** show when map center differs from user position by > 100m
3. **On tap:** `map.flyTo()` to user position with smooth animation
4. **During navigation:** button re-enables auto-follow mode (map tracks user)
5. **Icon states:** hollow (not following) / filled (following) -- standard Google Maps pattern
6. **Size:** 44x44px minimum touch target per Apple HIG

**Confidence:** HIGH -- This is a universally standardized UX pattern across Google Maps, Apple Maps, OsmAnd, Gaia GPS.

## Flexible Start Point: Expected Behavior

1. **Default:** route starts at current GPS position (existing behavior)
2. **Activation:** user taps on map within 300m radius to move start pin
3. **Visual feedback:** show a subtle 300m radius circle around GPS position when in "set start" mode, or always show a faint circle to indicate the allowed range
4. **Constraint enforcement:** if tap is > 300m from GPS, snap to nearest point within 300m radius on the vector from GPS to tap
5. **Reset mechanism:** button to return start to GPS position ("Reset start" or tap the GPS dot)
6. **Rationale for 300m:** ensures the runner does not have to walk far to reach the start. Far enough to reach a nearby park entrance or waterfront path.
7. **Interaction with route modes:** in Nature mode, could auto-suggest snapping to nearest park entrance within 300m (differentiator, not required for v1.1)

**Confidence:** MEDIUM -- The 300m constraint is specific to RundLoop's PRD. General pattern (tap-to-set-start) is well-established in Ride with GPS and plotaroute.

## MVP Recommendation

Prioritize in this order:

1. **iOS GPS permission fix** -- Prerequisite for GPS auto-center. Fix the silent simulation issue first.
2. **Map GPS auto-center on open** -- Low complexity, immediate UX improvement, no feature dependencies
3. **"Center on me" button** -- Low complexity, expected standard, pairs with auto-center
4. **iOS layout fix (button overlap)** -- Fix before adding new buttons to avoid compounding issues
5. **Route mode toggle UI** -- Low complexity, enables everything else
6. **Nature/Explore mode via AI prompt** (Tier 1) -- Medium complexity, quick win, immediately differentiating
7. **Flexible start point** -- Medium complexity, standalone feature
8. **iOS Safari black screen fix** -- Independent bug fix, can be parallelized
9. **Overpass POI enrichment** (Tier 2) -- Medium-high complexity, enhances route quality significantly

**Defer to v1.2+:**
- **Green score rating** -- High complexity, requires spatial analysis
- **POI labels on map** -- Depends on Overpass integration being stable first
- **Route preview POI chips** -- Nice-to-have, not essential for v1.1
- **Terrain/surface preferences** -- Requires OSRM customization

## iOS-Specific Considerations for v1.1

The PRD lists three iOS bugs to fix alongside these features:

| Bug | Impact on v1.1 Features | Priority |
|-----|------------------------|----------|
| **iOS Safari black screen** | Map rendering issue, likely WebGL context loss or tile layer init race. Independent of feature work but blocks all map features visually. | High -- fix early |
| **iOS layout fix (button overlap with tab bar)** | CSS/safe-area issue. Must be fixed before adding "center on me" button to avoid compounding layout problems. | High -- fix before new UI |
| **iOS GPS UX (explicit permission flow)** | Must be fixed before GPS auto-center. Auto-center depends on GPS permission being granted. Silent simulation hides the problem. | Critical -- fix first |

**Recommendation:** Fix iOS GPS permission flow first, then build GPS auto-center on top of the fixed flow.

## Sources

- [Trail Router -- How it works](https://trailrouter.com/blog/how-trail-router-works/) -- Detailed technical breakdown of OSM-based green routing algorithm
- [Trail Router -- About](https://trailrouter.com/about/) -- Algorithm description: 30m buffer zone, green index calculation, PostGIS spatial queries
- [Strava Points of Interest and Start Points](https://support.strava.com/hc/en-us/articles/4420443741453-Points-of-Interest-and-Start-Points) -- POI routing patterns
- [Strava Generated Community Routes](https://support.strava.com/hc/en-us/articles/360039136692-Generated-Community-Routes) -- Community-powered route generation
- [Komoot -- Planning Tours using POIs](https://support.komoot.com/hc/en-us/articles/360022831312-Planning-Tours-using-POIs-Points-of-Interest) -- POI-based route planning, "Highlights" feature
- [Komoot Features](https://www.komoot.com/features) -- Highlights and explore mode
- [Overpass API by Example](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example) -- OSM POI query patterns and syntax
- [OSM Key:tourism](https://wiki.openstreetmap.org/wiki/Key:tourism) -- Tourism tag taxonomy (viewpoint, attraction, museum)
- [OSM Key:historic](https://wiki.openstreetmap.org/wiki/Key:historic) -- Historic tag taxonomy (monument, memorial, castle)
- [Ride with GPS -- Change Start](https://support.ridewithgps.com/hc/en-us/articles/27321702268443-Change-Start) -- Flexible start point UX pattern
- [Google Maps iOS SDK -- My Location Button](https://developers.google.com/maps/documentation/ios-sdk/examples/enable-my-location) -- Standard location button implementation
- [Gaia GPS -- Locate and Orient](https://help.gaiagps.com/hc/en-us/articles/360047951533-Locate-and-Orient-Yourself-on-the-Map) -- Map centering UX: three-state location button pattern
