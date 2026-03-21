# Pitfalls Research

**Domain:** Scenic/POI route generation, map GPS centering, flexible start points for running PWA
**Researched:** 2026-03-21
**Confidence:** HIGH (based on codebase analysis + verified external sources)

## Critical Pitfalls

### Pitfall 1: LLM Coordinate Hallucination in Scenic Waypoint Generation

**What goes wrong:**
The current `route-ai.ts` sends a text prompt to Claude Haiku asking for waypoints. When adding Nature/Explore modes, the prompt will request POI-aware waypoints (parks, waterfronts, landmarks). LLMs regularly hallucinate GPS coordinates -- they invent plausible-looking lat/lng pairs that land in water, on highways, inside buildings, or in entirely wrong neighborhoods. Research confirms LLMs "assume the existence of non-existent paths" and "struggle to plan correct paths due to hallucination issues."

**Why it happens:**
LLMs have no real spatial awareness. They approximate coordinates from training data. The more specific the request (e.g., "route past Humlegarden park in Stockholm"), the more likely the model returns coordinates that are close but not actually on a runnable path. The current system relies on OSRM to snap waypoints to roads, which masks some errors but creates bizarre detours when waypoints are in unreachable locations.

**How to avoid:**
- Do NOT rely solely on the LLM for scenic waypoint coordinates. Use a two-stage approach: (1) query Overpass API for real POI coordinates matching the mode, (2) feed those real coordinates to the LLM or algorithmic pipeline for route shape selection.
- Alternatively, skip the LLM for coordinate generation entirely: use Overpass to find POIs, score them by relevance to the route mode, and select the best subset as waypoints.
- Add a validation step: reject any AI-generated waypoint more than the route radius from the start point or that OSRM cannot snap to a foot-accessible road within 500m.

**Warning signs:**
- Routes that have long thin spikes (OSRM routing to a distant waypoint and back)
- Routes where the OSRM distance is much longer than expected for the number of waypoints
- Waypoints that fall on water bodies or restricted areas

**Phase to address:**
Route mode implementation phase -- the scenic waypoint selection logic must include coordinate validation from day one.

---

### Pitfall 2: Overpass API Rate Limiting and Reliability

**What goes wrong:**
The public Overpass API (`overpass-api.de`) uses automatic load shedding. Each request occupies a slot for execution time plus a cooldown period. Under load, requests queue for up to 15 seconds then return HTTP 429. For a consumer PWA where every route generation triggers an Overpass query, this can break the "route generation < 10s" performance constraint.

**Why it happens:**
The public Overpass API is a shared community resource, not a commercial service. It has no SLA, no guaranteed uptime, and actively rate-limits heavy users. Developers treat it like a reliable API and build no fallback path.

**How to avoid:**
- Cache POI data aggressively. Parks, landmarks, and green spaces don't move. Cache by geographic tile (e.g., ~1km grid cells) in IndexedDB with a 7-day TTL.
- Keep Overpass queries minimal: fetch POIs within a bounding box around the start point, not the entire city. Use `[out:json][timeout:10][maxsize:2097152]` to keep queries fast and bounded.
- Build a graceful fallback: if Overpass fails or times out, fall back to the existing algorithmic route generation (no scenic enrichment rather than no route at all).
- Consider pre-fetching POIs when the user opens the app (background fetch while viewing the map), so data is ready before route generation starts.
- Use alternative Overpass instances (e.g., `overpass.kumi.systems`) as failover.

**Warning signs:**
- Route generation times spike above 10 seconds intermittently
- Users in certain regions consistently fail to generate scenic routes
- HTTP 429 errors appearing in console

**Phase to address:**
Route mode implementation phase -- Overpass integration must include caching and fallback from the start. Do not add Overpass as a hard dependency.

---

### Pitfall 3: OSM POI Data Quality Varies Wildly by Region

**What goes wrong:**
The app assumes Overpass/OSM will return useful POIs (parks, landmarks, waterfronts) for any location. Research shows OSM POI completeness averages only 22% compared to ground truth in some categories. Parks and green spaces "are not mapped consistently and with the same level of completeness everywhere." A user in a well-mapped European city gets great scenic routes. A user in a suburban US neighborhood or developing country gets zero POIs and either a broken route or a generic non-scenic route with no feedback about why.

**Why it happens:**
OSM is crowd-sourced. Coverage depends entirely on local contributor activity. Developers test in well-mapped cities (Stockholm, London) and assume global coverage.

**How to avoid:**
- Always count returned POIs before building a scenic route. If fewer than 2-3 relevant POIs exist within the route radius, fall back gracefully to algorithmic mode and show the user a message: "Limited scenic data in this area -- generating a standard route."
- Use broad OSM tag queries: for Nature mode, don't just query `leisure=park` -- also include `natural=water`, `landuse=forest`, `landuse=grass`, `leisure=garden`, `waterway=river`, `landuse=meadow`. Cast a wide net.
- For Explore mode, query `tourism=*`, `historic=*`, `amenity=place_of_worship`, `natural=peak`, `man_made=tower` -- landmarks are tagged inconsistently in OSM.
- Test with locations known to have poor OSM coverage (rural areas, non-European cities).

**Warning signs:**
- Overpass returns empty results for valid queries in certain locations
- "Nature" mode produces routes identical to standard mode
- User reports that scenic routes feel generic

**Phase to address:**
Route mode implementation phase -- POI fallback logic is a first-class requirement, not an afterthought.

---

### Pitfall 4: GPS Auto-Centering Race Condition on App Open

**What goes wrong:**
The map initializes with a hardcoded center (`[18.0686, 59.3293]` -- Stockholm) in `MapView.tsx` and then requests GPS position asynchronously. On iOS Safari PWA, `getCurrentPosition` can take 2-10 seconds. The user sees a map of Stockholm for several seconds before it jumps to their actual location. Worse: on iOS, the location permission prompt in standalone PWA mode sometimes fails to appear entirely, leaving the map stuck on the wrong continent.

**Why it happens:**
The current `MapView.tsx` initializes the map synchronously but GPS is asynchronous. There is no loading state or permission flow. iOS Safari has documented bugs with geolocation permission dialogs in standalone PWA mode.

**How to avoid:**
- Cache the last known GPS position in IndexedDB or localStorage. On app open, center on the cached position immediately, then update when fresh GPS arrives.
- Show a loading/skeleton state until GPS position is acquired if no cached position exists. Do NOT show a map centered on a default location on another continent.
- Implement an explicit GPS permission flow: check `navigator.permissions.query({name: 'geolocation'})` first. If denied, show a custom UI explaining how to enable it in iOS Settings. If prompt, show a custom pre-prompt explaining why GPS is needed before triggering the native dialog.
- Set a reasonable timeout (5 seconds) on `getCurrentPosition` and show a "Can't find your location" fallback with a manual "Center on me" button.

**Warning signs:**
- Map briefly shows Stockholm for non-Stockholm users on app open
- iOS users report "blank map" or "map won't center on me"
- No GPS permission prompt appears on installed PWA

**Phase to address:**
Map centering phase -- this must be the first thing implemented, before route modes, because it affects the core map UX for all users.

---

### Pitfall 5: Flexible Start Point Generates Unrunnable First/Last Segments

**What goes wrong:**
The "flexible start within 300m" feature lets the route start at a better location (park entrance, trail head) near the user rather than exactly at the GPS position. But the segment from the user's actual position to the route start point is not routed -- the user must figure out how to get there on their own. This segment can cross a highway, go through a building, or require navigating a complex interchange. The user opens the app, sees "start running," and immediately faces a confusing off-route segment.

**Why it happens:**
The route generation considers the start point as a waypoint for OSRM, but the walk from GPS position to flexible start point is invisible. The developer assumes 300m is trivially walkable in any direction.

**How to avoid:**
- Always OSRM-route the segment from the user's GPS position to the flexible start point. Include it as the first leg of the route with navigation instructions.
- Show the walking segment as a visually distinct dashed line on the map with a "Walk to start" indicator, making it clear this is not the running route.
- Validate that the flexible start point is reachable on foot using OSRM walking distance, not haversine distance. A point 300m haversine away might be 800m by foot if there is a river or highway in between. Reject start points where walking distance exceeds 2x the haversine distance.

**Warning signs:**
- Users report confusion about where to start running
- First few hundred meters of GPS trace diverge from the displayed route
- GPS tracking shows the user walking away from the route at the beginning

**Phase to address:**
Flexible start point phase -- the routing from GPS to start point is part of the feature, not separate from it.

---

### Pitfall 6: Scenic Mode Breaks Distance Calibration

**What goes wrong:**
The current system uses binary search calibration and a `ROAD_ROUTING_FACTOR = 3.0` to hit target distances. When scenic waypoints are added (detouring through parks, along waterfronts), the effective road routing factor changes significantly. A user asks for 5km, the scenic route detours through a park and along a waterfront, and the result is 7.5km because the calibration assumes direct geometric waypoints, not POI-attracted waypoints that pull the route off the geometric path.

**Why it happens:**
The `ROAD_ROUTING_FACTOR = 3.0` in `route-algorithmic.ts` was tuned for geometric patterns (circle, figure-8, cloverleaf). Scenic waypoints break the geometric assumptions because they pull the route shape toward POIs that may be asymmetrically distributed around the start point.

**How to avoid:**
- Keep the binary search calibration loop but run it with scenic waypoints included. Generate scenic waypoints first, then calibrate the radius/distance to hit the target distance through the calibration loop.
- Set wider tolerance for scenic routes (e.g., +/-15% vs +/-10% for standard routes) and communicate this to the user: "Your scenic route is approximately 5.2km."
- Alternatively, generate the scenic route first with approximate distance, then trim or extend by adding/removing the least-scenic waypoint to get closer to target.

**Warning signs:**
- Scenic routes consistently overshoot or undershoot target distance by >15%
- Binary search calibration takes more iterations for scenic routes (>8 OSRM calls)
- Users complain that "5km Nature run" is actually 7km

**Phase to address:**
Route mode implementation phase -- distance calibration must be tested with scenic waypoints, not just geometric ones.

---

### Pitfall 7: "Center on Me" Button Fights the Existing Auto-Rotation System

**What goes wrong:**
The current `MapView.tsx` already has a `showRecenter` state and `isAutoRotating` ref for navigation mode. Adding a "Center on me" button for the non-navigating state creates two overlapping centering systems. The button re-centers the map, but then the user pans away, and the next GPS update re-centers again because the centering mode was re-enabled. Or worse: during navigation, the "Center on me" button conflicts with the heading-up auto-rotation, causing the map to jitter between north-up centering and heading-up rotation.

**Why it happens:**
The existing code tracks `isAutoRotating` for navigation. Adding a second "centering" concept for the idle/planning state without unifying the state machine creates ambiguous states.

**How to avoid:**
- Unify map centering into a single state machine with clear modes: `idle` (no centering, user can pan freely), `centered` (map follows GPS, north-up), `navigating` (map follows GPS, heading-up with rotation). The "Center on me" button transitions from `idle` to `centered`. User panning transitions from `centered` to `idle`. Starting a run transitions to `navigating`.
- The existing `showRecenter` state and `isAutoRotating` ref should be refactored into this unified model rather than adding more booleans.

**Warning signs:**
- Map jumps unexpectedly after panning during route planning
- "Center on me" button works but map immediately pans away
- Tapping "Center on me" during navigation causes heading-up rotation to break

**Phase to address:**
Map centering phase -- must be designed as a unified state machine before implementation.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded Stockholm default center in MapView.tsx | Map renders immediately | Wrong location for all non-Stockholm users, disorienting UX | Never -- replace with cached GPS or loading state in v1.1 |
| Client-side LLM API calls with `anthropic-dangerous-direct-browser-access` | No backend needed | API key exposure, can't add server-side caching/rate-limiting | Only while user provides own key. Move to API routes when adding scenic prompts. |
| Single `ROAD_ROUTING_FACTOR = 3.0` constant | Works for geometric patterns | Breaks when waypoint distribution changes (scenic modes) | Must be replaced with per-route calibration for scenic modes |
| Querying Overpass on every route generation without caching | Simpler implementation | Slow route generation, rate limiting, Overpass dependency | Only for initial prototype. Add caching before shipping. |
| Boolean flags for map centering state (`isAutoRotating`, `showRecenter`) | Quick to implement | Conflicting states when adding "Center on me" button | Refactor to state machine when adding centering features |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Overpass API | Building complex Overpass QL queries that timeout | Use simple `[out:json][timeout:10];` with bbox and a few tag filters. Keep queries under 5 seconds. |
| Overpass API | Querying for exact POI types only (`tourism=viewpoint`) | Query broad categories and filter client-side. OSM tagging is inconsistent -- a viewpoint might be tagged `tourism=viewpoint`, `natural=peak`, or `historic=monument`. |
| Overpass API | Not setting timeout and maxsize in query | Always prepend `[timeout:10][maxsize:2097152]` to prevent runaway queries that consume your rate limit slot for 180 seconds. |
| OSRM with scenic waypoints | Sending waypoints that are inside parks (not on roads) | OSRM snaps to nearest road, but if the nearest road is far away, the route becomes bizarre. Pre-snap waypoints to nearest road using OSRM's `nearest` service before routing. |
| MapLibre GeolocateControl | Using the built-in GeolocateControl alongside custom GPS tracking | Pick one. The app already has custom GPS tracking via `watchFilteredPosition`. Use the custom system for centering too, don't add GeolocateControl on top -- they will fight. |
| iOS Safari geolocation | Calling `getCurrentPosition` without checking permission state first | Check `navigator.permissions.query({name:'geolocation'})` first. Handle the `denied` state with a custom UI, not a silent failure. |
| Claude Haiku for scenic prompts | Asking the LLM to both name POIs AND provide coordinates | Let the LLM suggest POI types/names for the route mode, but resolve coordinates via Overpass. The LLM is good at "what's interesting here" but bad at "what are the exact coordinates." |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Overpass query on every route generation | 2-8 second delay added to route generation | Cache POI data by geographic tile in IndexedDB with 7-day TTL | First route generation in any new area |
| Fetching all POIs in large radius | Query returns thousands of results, parsing slow on mobile | Limit radius to route distance / 2, cap results with `[maxsize:2097152]` | Any query in a densely-mapped city center (e.g., central London returns 5000+ tourism POIs) |
| Re-centering map on every GPS update in idle mode | Map feels jittery, user cannot pan to explore route options | Only auto-center when in `centered` mode. Disable on any user interaction. | Immediately -- any GPS update rate >1Hz |
| Scenic waypoint scoring with many POIs | O(n*m) comparison of candidate waypoints to POIs | Pre-filter POIs by distance from route corridor, limit candidates to top 20 per category | >50 POIs in query results |
| Multiple OSRM calls for scenic calibration | Binary search now needs Overpass + OSRM per iteration | Fetch POIs once, cache them, only OSRM calls iterate during calibration | When scenic calibration exceeds 8 iterations |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sending precise GPS coordinates to LLM APIs without user awareness | Location privacy concern -- API provider sees exact user location | Round coordinates to 3 decimal places (~100m precision) for scenic prompts. Inform user in privacy notice. |
| Caching POI data with user-specific metadata | Cached tiles could leak visit patterns if device is shared | Cache POI data without timestamps or user identifiers. POI cache is geographic, not personal. |
| Overpass queries revealing user location to OSM servers | OSM logs could show user locations | Acceptable risk -- same as loading map tiles. No mitigation needed beyond standard HTTPS. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Scenic mode fails silently and returns generic route | User selects "Nature run," gets a route through an industrial area, doesn't understand why | Show a toast: "No parks found nearby -- showing standard route" with clear visual distinction between scenic and standard routes |
| Map jumps from Stockholm to GPS position on cold start | Disorienting 2-3 second flash of wrong continent | Show loading skeleton until GPS acquired, or use cached last-known position for instant centering |
| "Center on me" button does nothing when GPS is denied | User taps button, nothing happens, no feedback | Show modal explaining GPS is needed and how to enable it in iOS Settings > Safari > Location Services |
| Flexible start point not explained to user | User doesn't understand why route starts 200m away from their position | Show walking distance to start, dashed line on map, "Walk to start" label with estimated walking time |
| Route mode toggle buried in settings or hidden behind menu | Users don't discover Nature/Explore modes | Place mode toggle prominently on the main map view, near the distance slider, with clear icons/labels |
| Scenic route looks identical to standard route on map | User selected scenic mode but can't tell the difference | Highlight scenic segments (park paths, waterfront) with a different color or icons. Show POI markers on the route. |

## "Looks Done But Isn't" Checklist

- [ ] **GPS centering:** Often missing permission-denied handling -- verify iOS standalone PWA permission flow works (not just browser tab)
- [ ] **GPS centering:** Often missing cached last-known position -- verify cold start doesn't show Stockholm for non-Stockholm users
- [ ] **Overpass integration:** Often missing timeout/fallback -- verify route generates successfully when Overpass is unreachable (disable network to Overpass in devtools)
- [ ] **Scenic waypoints:** Often missing distance recalibration -- verify a 5km Nature route actually produces 4.5-5.5km after OSRM routing
- [ ] **Scenic waypoints:** Often missing coordinate validation -- verify no waypoints land in water, on highways, or outside the route area
- [ ] **Flexible start:** Often missing the first segment routing -- verify OSRM routes from GPS position to flexible start, not just haversine check
- [ ] **Flexible start:** Often missing visual distinction -- verify dashed walking line is visually different from the running route
- [ ] **POI fallback:** Often missing user feedback -- verify the user sees a message when scenic mode falls back to standard
- [ ] **Center on me button:** Often missing the "re-enable tracking" behavior -- verify that after manual pan, tapping "center on me" re-enables auto-follow
- [ ] **Center on me button:** Often missing behavior during navigation -- verify it doesn't break heading-up auto-rotation
- [ ] **Route mode toggle:** Often missing persistence -- verify selected mode persists across app sessions via IndexedDB settings

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| LLM hallucinated waypoints shipping to users | LOW | Add waypoint validation (distance from center, OSRM reachability check). Can be added as a post-processing step without changing the pipeline. |
| Overpass hard dependency causes route generation failures | MEDIUM | Extract Overpass calls behind an interface, add IndexedDB cache layer, implement fallback to algorithmic mode. Requires refactoring route generation pipeline. |
| Distance calibration broken for scenic routes | LOW | Add scenic-specific calibration or switch to per-route calibration loop. Isolated change in route generation module. |
| GPS centering not working on iOS standalone PWA | MEDIUM | Requires testing on physical iOS devices. Fix may involve Safari-specific workarounds and a custom permission UI. Cannot be fixed in simulator. |
| Flexible start creates confusing first segment | LOW | Add OSRM routing for first/last segment. Purely additive change, no refactoring needed. |
| Map centering state machine conflicts | MEDIUM | Refactor boolean flags to unified state machine. Requires touching MapView.tsx centering logic. Risk of regression in navigation auto-rotation. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| GPS centering race condition | Map centering phase (do FIRST) | Cold start on iOS PWA: no Stockholm flash, cached position used, permission-denied shows helpful UI |
| Center on me state conflicts | Map centering phase | Pan map, tap center button, verify map centers. Start navigation, verify heading-up works. Pan during nav, tap center, verify heading-up re-engages. |
| LLM coordinate hallucination | Route mode implementation | Generate 10 scenic routes, verify all waypoints within route bounding box and OSRM-routable within 500m |
| Overpass rate limiting | Route mode implementation | Generate 5 routes in rapid succession, verify no 429 errors. Disable Overpass, verify fallback works. |
| OSM POI data gaps | Route mode implementation | Generate scenic routes in 3 regions: Stockholm (well-mapped), US suburb, rural area. Verify graceful fallback. |
| Scenic distance calibration | Route mode implementation | Generate 20 scenic routes at 5km, verify mean distance within 10% of target |
| Flexible start unroutable segment | Flexible start phase | Verify walking segment shown as dashed line. Verify OSRM distance (not haversine) used for 300m limit. |
| Client-side API key exposure | Tech debt (during or after route modes) | Audit for `anthropic-dangerous-direct-browser-access`. Document decision on client vs server API calls. |

## Sources

- [Overpass API documentation](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) -- rate limiting behavior, slot/cooldown model
- [Overpass API wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) -- query best practices, timeout/maxsize parameters
- [Alternative Overpass instances](https://overpass.kumi.systems/) -- failover endpoints
- [OSM POI quality research](https://journals.sagepub.com/doi/10.1177/03611981231169280) -- 22% completeness finding for private business POI
- [OSM community forum on POI quality](https://community.openstreetmap.org/t/poi-quality-and-usage-any-corporates-contributing/107488) -- "quite hit and miss"
- [LLM spatial hallucination mitigation research](https://www.nature.com/articles/s41598-025-93601-5) -- LLMs assume non-existent paths
- [LLM geocoding performance study](https://blog.gdeltproject.org/generative-ai-experiments-the-surprisingly-poor-performance-of-llm-based-geocoders-geographic-bias-why-gpt-3-5-gemini-pro-outperform-gpt-4-0-in-underrepresented-geographies/) -- coordinate generation unreliability
- [iOS PWA geolocation bug](https://developer.apple.com/forums/thread/694999) -- location alert not appearing in standalone mode
- [MapLibre GeolocateControl docs](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/) -- trackUserLocation behavior
- Codebase analysis: `route-ai.ts`, `route-algorithmic.ts`, `route-osrm.ts`, `MapView.tsx`, `gps-filter.ts`

---
*Pitfalls research for: Scenic routing, POI integration, GPS centering, flexible start points in RundLoop v1.1*
*Researched: 2026-03-21*
