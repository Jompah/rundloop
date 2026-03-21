# Architecture Patterns

**Domain:** Scenic route generation integration for running PWA
**Researched:** 2026-03-21

## Current Architecture (Baseline)

The existing pipeline is clean and well-separated:

```
User sets distance
    |
    v
RouteMode switch (page.tsx handleGenerate)
    |--- 'algorithmic' --> route-algorithmic.ts (geometric patterns)
    |--- 'ai'          --> route-ai.ts (Claude Haiku prompt)
    |
    v
RouteWaypoint[] (6-12 lat/lng points)
    |
    v
Binary search calibration loop (page.tsx)
    |--- Scales waypoints relative to start point
    |--- Calls routeViaOSRM() per iteration
    |--- Converges within 20% tolerance
    |
    v
routeViaOSRM() --> OSRM public API (foot profile)
    |
    v
GeneratedRoute { waypoints, polyline, distance, duration, instructions }
    |
    v
MapView renders polyline + markers
```

**Key observations from code:**
- `RouteMode` is currently `'ai' | 'algorithmic'` (types/index.ts:34)
- AI prompt is hardcoded in `ROUTE_PROMPT` (route-ai.ts:12-28) -- already mentions "prefer parks, waterfront paths"
- Algorithmic mode is pure geometry (circle/figure8/cloverleaf) with no awareness of surroundings
- The binary search calibration in `handleGenerate` (page.tsx:158-283) is route-mode-agnostic -- it scales any waypoints
- API calls go directly from browser to Claude/Perplexity (no server-side proxy despite CLAUDE.md saying "API keys server-side only")
- `AppSettings` has `apiProvider` and `apiKey` but no route mode preferences

## Recommended Architecture for v1.1

### Design Principle: Extend the Prompt, Not the Pipeline

The existing pipeline is solid. The scenic route modes (Nature/Explore) should be implemented by **modifying the AI prompt** and **extending the type system**, not by adding new routing engines or external POI APIs. OSRM handles road snapping. Claude Haiku handles waypoint intelligence. Adding a third-party POI API (Overpass/Google Places) would add latency, complexity, and a new failure mode for marginal benefit -- Claude already knows about parks, landmarks, and waterfronts from its training data.

### Component Boundaries

| Component | Current Responsibility | v1.1 Change | Modification Type |
|-----------|----------------------|-------------|-------------------|
| `types/index.ts` | Type definitions | Add `ScenicMode` type, extend `AppSettings` | MODIFY |
| `route-ai.ts` | AI waypoint generation | Mode-aware prompt templates, flexible start point | MODIFY |
| `route-algorithmic.ts` | Geometric waypoints | No changes (scenic modes are AI-only) | NO CHANGE |
| `route-osrm.ts` | OSRM routing | No changes needed | NO CHANGE |
| `page.tsx` | Route orchestration, state | Pass scenic mode to generator, offset start point | MODIFY |
| `RouteGenerator.tsx` | UI for route config | Add mode toggle (Nature/Explore/Standard) | MODIFY |
| `MapView.tsx` | Map rendering | Add "center on me" button, GPS auto-center on mount | MODIFY |
| `geolocation.ts` | GPS utilities | No changes needed | NO CHANGE |
| `components/RouteModeToggle.tsx` | Does not exist | New component: segmented control for route mode | NEW |

### Data Flow Changes

#### 1. Scenic Mode Selection

```
NEW: ScenicMode = 'standard' | 'nature' | 'explore'

User selects mode via RouteModeToggle
    |
    v
page.tsx state: scenicMode (separate from routeMode 'ai'|'algorithmic')
    |
    v
handleGenerate passes scenicMode to route-ai.ts
    |
    v
route-ai.ts selects prompt template based on scenicMode
    |
    v
Same pipeline: waypoints --> binary search --> OSRM --> render
```

**Important distinction:** `RouteMode` ('ai' | 'algorithmic') controls the generation engine. `ScenicMode` ('standard' | 'nature' | 'explore') controls the AI prompt flavor. When `routeMode === 'algorithmic'`, scenic mode has no effect (geometric patterns are location-unaware). This should be communicated in UI.

#### 2. Flexible Start Point

```
User GPS position: [lat, lng]
    |
    v
NEW: Start point offset (0-300m from GPS)
    |--- Option A: AI picks optimal start (prompt instructs "pick best nearby start")
    |--- Option B: Algorithmic offset toward nearest park/path entrance
    |
    v
Waypoints[0] and Waypoints[last] = offset start point (not GPS position)
    |
    v
Binary search calibration uses offset start as anchor
    |
    v
OSRM routes from offset start through waypoints back to offset start
```

**Recommendation: Option A (AI picks start).** The Claude prompt already generates the first waypoint. Currently the code forces it to match GPS (route-ai.ts:113-131). Instead, allow the AI to pick a start point within 300m, and validate the distance constraint in code rather than forcing exact GPS match.

For algorithmic mode: offset the geometric center by a random vector of 50-200m before generating the pattern. Simple and effective.

#### 3. GPS Map Centering

```
MapView mount
    |
    v
NEW: If userLocation available, map.flyTo(userLocation, zoom=15)
    |
    v
NEW: "Center on me" FAB button (bottom-right, above tab bar)
    |--- onClick: map.flyTo(userLocation, zoom=15, duration=500)
    |--- Disabled when no GPS fix
    |--- Icon: crosshair/target
```

This is purely a MapView change. No impact on route generation pipeline.

### Type System Changes

```typescript
// types/index.ts -- additions

export type ScenicMode = 'standard' | 'nature' | 'explore';

// Extend AppSettings
export interface AppSettings {
  // ... existing fields
  scenicMode?: ScenicMode;       // Persisted preference
  flexibleStart?: boolean;       // Allow 300m start offset
}

// Extend AIRouteRequest (route-ai.ts)
interface AIRouteRequest {
  lat: number;
  lng: number;
  distanceKm: number;
  cityName: string;
  settings: AppSettings;
  scenicMode: ScenicMode;        // NEW
  flexibleStart: boolean;        // NEW
}
```

### Prompt Architecture

The core architectural decision: **mode-specific prompt templates** in `route-ai.ts`.

```typescript
// route-ai.ts -- new prompt structure

const MODE_INSTRUCTIONS: Record<ScenicMode, string> = {
  standard: `
- Prefer parks, waterfront paths, pedestrian areas, and quiet residential streets
- Avoid highways, industrial areas, and busy roads
- Create an interesting loop, not an out-and-back route`,

  nature: `
- STRONGLY prioritize parks, nature reserves, waterfronts, rivers, canals, and green corridors
- Seek out tree-lined paths, botanical gardens, lakeside trails, and forest edges
- Avoid commercial districts, busy intersections, and industrial zones
- Prefer unpaved paths and park trails when they exist
- The route should feel like escaping the city into nature`,

  explore: `
- STRONGLY prioritize scenic landmarks, historic districts, viewpoints, and cultural sites
- Seek out famous buildings, monuments, plazas, bridges with views, and touristy areas
- Include interesting architecture, street art areas, and photogenic spots
- The route should feel like a sightseeing tour on foot
- Prefer well-lit, pedestrian-friendly streets`,
};

const FLEXIBLE_START_INSTRUCTION = `
- You may place the first waypoint up to 300 meters from the starting coordinates
  if doing so creates a better route (e.g., starting at a park entrance or trail head)
- The last waypoint must still return to the FIRST waypoint (not the GPS coordinates)`;
```

This approach keeps the prompt composable and testable without changing the downstream pipeline.

## Patterns to Follow

### Pattern 1: Prompt Composition over Pipeline Branching

**What:** Build scenic modes by composing prompt segments, not by adding new API calls or routing engines.
**When:** Any time a new "mode" or "preference" affects route quality.
**Why:** The binary search calibration loop, OSRM routing, and MapView rendering are mode-agnostic. Changing prompts is the minimal intervention.

```typescript
function buildPrompt(req: AIRouteRequest): string {
  const modeInstructions = MODE_INSTRUCTIONS[req.scenicMode];
  const startInstructions = req.flexibleStart ? FLEXIBLE_START_INSTRUCTION : '';
  return ROUTE_PROMPT_TEMPLATE(req.lat, req.lng, req.distanceKm, req.cityName, modeInstructions, startInstructions);
}
```

### Pattern 2: Separate Concern Axes

**What:** `RouteMode` (engine selection) and `ScenicMode` (prompt flavor) are orthogonal. Keep them as separate state variables and separate type definitions.
**When:** Adding any new dimension to route configuration.
**Why:** Avoids combinatorial explosion. `ScenicMode` only applies to AI mode, and the UI can gray out the toggle when algorithmic is selected.

### Pattern 3: Validate AI Output, Don't Trust It

**What:** After Claude returns waypoints for flexible start, validate the start point is within 300m of GPS. If not, clamp it.
**When:** Any time the AI is given latitude in output (like choosing start points).

```typescript
function clampStartPoint(aiStart: RouteWaypoint, gpsLat: number, gpsLng: number, maxMeters: number): RouteWaypoint {
  const dist = haversineDistance(aiStart.lat, aiStart.lng, gpsLat, gpsLng);
  if (dist <= maxMeters) return aiStart;
  // Clamp to max distance along the vector from GPS to AI start
  const ratio = maxMeters / dist;
  return {
    lat: gpsLat + (aiStart.lat - gpsLat) * ratio,
    lng: gpsLng + (aiStart.lng - gpsLng) * ratio,
  };
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding a POI API Layer

**What:** Fetching POIs from Overpass/Google Places and passing them to the AI prompt.
**Why bad:** Adds 1-3s latency, a new external dependency, rate limiting concerns, and the AI already has geographic knowledge baked into its training. The marginal quality gain does not justify the complexity for v1.1.
**Instead:** Rely on Claude's training data for location awareness. If quality is insufficient after testing, a POI layer can be added in a later milestone as a prompt enrichment step (not a pipeline change).

### Anti-Pattern 2: Merging RouteMode and ScenicMode

**What:** Changing `RouteMode` from `'ai' | 'algorithmic'` to `'ai-standard' | 'ai-nature' | 'ai-explore' | 'algorithmic'`.
**Why bad:** Combinatorial coupling. If you later add `'ai-training'` mode, you need to update every switch statement.
**Instead:** Keep them as two orthogonal enums. The generation function checks both.

### Anti-Pattern 3: Modifying the Binary Search for Scenic Modes

**What:** Changing calibration tolerance or iteration count based on scenic mode.
**Why bad:** The calibration loop is mode-agnostic by design. Scenic modes affect waypoint selection, not distance accuracy.
**Instead:** Keep the binary search identical. It already handles any set of waypoints.

### Anti-Pattern 4: Server-Side Route Generation (for now)

**What:** Moving the Claude API call to a Next.js API route.
**Why bad in context:** While the CLAUDE.md says "API keys server-side only," the existing v1.0 architecture uses direct browser-to-Claude calls with `anthropic-dangerous-direct-browser-access`. Changing this in v1.1 is a separate concern (security hardening) that should not be mixed with feature work. Flag it but do not block scenic mode on it.
**Instead:** Document this as tech debt. Address in a dedicated security phase.

## Integration Points (New vs Modified)

### NEW Components

| Component | Purpose | Dependencies |
|-----------|---------|--------------|
| `RouteModeToggle.tsx` | Segmented control: Standard / Nature / Explore | None (pure UI) |
| `CenterOnMeButton.tsx` | FAB button to re-center map on GPS | MapView map ref |

### MODIFIED Components

| Component | What Changes | Risk |
|-----------|-------------|------|
| `types/index.ts` | Add `ScenicMode`, extend `AppSettings` | LOW -- additive |
| `route-ai.ts` | Mode-aware prompt templates, flexible start validation | MEDIUM -- prompt quality needs testing |
| `page.tsx` | New state (`scenicMode`), pass to generator, start point offset logic | MEDIUM -- touches orchestration |
| `RouteGenerator.tsx` | Render `RouteModeToggle`, pass mode up | LOW -- UI only |
| `MapView.tsx` | Auto-center on mount, expose flyTo for center button | LOW -- additive behavior |
| `SettingsView.tsx` | Persist scenic mode preference | LOW -- additive |

### UNCHANGED Components

| Component | Why No Change |
|-----------|--------------|
| `route-osrm.ts` | Routes any waypoints, mode-agnostic |
| `route-algorithmic.ts` | Geometric patterns, scenic mode is AI-only concern |
| `route-visuals.ts` | Visual rendering, independent of generation |
| `geolocation.ts` | GPS primitives, already sufficient |
| `NavigationView.tsx` | Navigation is post-generation, mode-irrelevant |
| `useRunSession.ts` | Run tracking, completely independent |
| All storage/DB code | Schema unchanged |

## Suggested Build Order

Based on dependency analysis:

```
Phase 1: Foundation (no visual changes, enables everything)
  1. Add ScenicMode type to types/index.ts
  2. Extend AppSettings with scenicMode, flexibleStart
  3. Refactor route-ai.ts prompt to composable template

Phase 2: GPS/Map UX (independent of scenic modes)
  4. MapView auto-center on GPS at mount
  5. CenterOnMeButton component
  6. Wire into MapView

Phase 3: Scenic Mode UI + Integration
  7. RouteModeToggle component
  8. Wire into RouteGenerator.tsx
  9. Wire scenicMode state through page.tsx to route-ai.ts
  10. Test scenic prompt quality (Nature in Stockholm, Explore in Barcelona)

Phase 4: Flexible Start Point
  11. Add flexible start logic to route-ai.ts prompt
  12. Add start point validation/clamping in page.tsx
  13. Update binary search to anchor on offset start
  14. Test: verify route returns to offset start, not raw GPS

Phase 5: iOS Fixes (independent)
  15. iOS Safari black screen fix
  16. iOS layout fix (button/tab bar overlap)
  17. iOS GPS permission UX flow
```

**Ordering rationale:**
- Types first (everything depends on them)
- GPS centering is independent and high user-value, ship early
- Scenic modes depend on type changes but not on GPS centering
- Flexible start depends on scenic prompt refactoring (Phase 3 prompt work)
- iOS fixes are independent, can be parallelized with any phase

## Scalability Considerations

| Concern | Current (v1.0) | v1.1 Impact | Future (v2+) |
|---------|----------------|-------------|---------------|
| AI API calls | 1 per generation | Same (prompt changes, not call count) | Could batch for comparison |
| OSRM calls | 6-18 per generation (calibration) | Same | Self-hosted OSRM if rate limited |
| Prompt size | ~200 tokens | ~300 tokens (mode instructions) | Could grow with POI context |
| Client state | 3-4 state vars for route | +2 (scenicMode, flexibleStart) | Manageable |
| Type complexity | 2 route-related types | +1 (ScenicMode) | Keep orthogonal |

## Sources

- Codebase analysis: `src/lib/route-ai.ts`, `src/lib/route-osrm.ts`, `src/lib/route-algorithmic.ts`, `src/app/page.tsx`, `src/types/index.ts` -- HIGH confidence (direct code reading)
- OSRM foot routing API behavior -- HIGH confidence (already validated in v1.0)
- Claude Haiku geographic knowledge for waypoint generation -- MEDIUM confidence (training data quality varies by city, needs empirical testing per scenic mode)
- Flexible start point 300m constraint -- HIGH confidence (simple haversine validation)
