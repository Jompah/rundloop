# Project Research Summary

**Project:** RundLoop v1.1 — Route Quality & Map UX
**Domain:** Scenic route generation, POI-aware running routes, mobile PWA map UX
**Researched:** 2026-03-21
**Confidence:** MEDIUM-HIGH

## Executive Summary

RundLoop v1.1 extends a validated v1.0 production stack (Next.js 16.2, React 19, MapLibre GL JS, OSRM, Claude Haiku, IndexedDB) with scenic route modes and map UX improvements. The research consensus is clear: implement scenic modes (Nature, Explore) via a two-tier approach — first extend the AI prompt with mode-specific instructions (quick win, ships immediately), then optionally enrich waypoints with real POI coordinates from Overpass API (quality improvement, phase 2). The existing route generation pipeline (waypoints -> binary search -> OSRM) is sound and should not be modified. All changes are prompt composition and UI additions on top of stable infrastructure.

The recommended approach requires zero new npm dependencies. Overpass API (free, no API key, raw `fetch()`) handles POI discovery for Nature mode via a server-side Next.js API route with in-memory grid caching. Claude Haiku's training data is sufficient for Explore mode landmarks in major cities. The most important sequencing constraint is iOS GPS permission UX: it must be fixed before map auto-centering is built, and both must ship before scenic modes, because scenic route quality depends on having an accurate GPS anchor point.

Key risks are: (1) LLM coordinate hallucination producing waypoints in water, on highways, or in wrong neighborhoods — mitigated by AI output validation and Overpass as coordinate ground truth; (2) Overpass rate limiting if uncached — mitigated by server-side grid caching with 1-hour TTL and graceful fallback to standard routing; (3) GPS centering race condition on iOS PWA causing a disorienting Stockholm flash — mitigated by caching last-known position in IndexedDB and implementing an explicit permission flow before calling `getCurrentPosition`.

## Key Findings

### Recommended Stack

The existing stack requires no additions for v1.1. The only new external service is the Overpass API (`overpass-api.de`), accessed via a Next.js API route (`/api/pois`) using raw `fetch()`. The server-side proxy is required to avoid CORS issues and to enable grid-cell caching. OSRM's public `nearest` service can snap flexible start points to walkable roads — but confidence is MEDIUM (it is part of the OSRM spec; public endpoint availability is unconfirmed and must be verified during implementation).

**Core technologies:**
- Overpass API: POI discovery for Nature mode — free, well-documented, no API key, `around:` radius syntax verified HIGH confidence
- Next.js API route `/api/pois`: Server-side Overpass proxy with in-memory grid caching — eliminates CORS, enables caching, required for rate limit management
- OSRM `nearest` service: Snap flexible start point to walkable road — same public endpoint as v1.0, availability unconfirmed (MEDIUM confidence)
- No new npm packages: Every v1.1 capability is achievable with the existing stack

**Reference:** STACK.md contains full OSM tag taxonomy by route mode and Overpass query examples.

### Expected Features

**Must have (table stakes):**
- Map auto-centers on GPS at app open — every map app does this; Stockholm hardcode is jarring for all non-Stockholm users
- "Center on me" button (44x44px, bottom-right, crosshair icon) — universal standard across Google Maps, Apple Maps, OsmAnd, Gaia GPS
- Route mode toggle UI (Standard / Nature / Explore segmented control) — must be prominent on main view, not buried in settings
- Nature mode biases routes toward parks, green spaces, waterways — core value prop of the feature
- Explore mode routes past landmarks and viewpoints — core value prop of the feature
- Flexible start point within 300m of GPS — tap-to-set-start pattern validated by Ride with GPS and plotaroute
- iOS Safari black screen fix, layout fix (button/tab bar overlap), GPS permission UX fix — prerequisites for GPS centering to function

**Should have (competitive):**
- Overpass API POI enrichment for Nature mode — distinguishes data-driven routes from hallucinated ones; TrailRouter's competitive advantage
- OSRM-routed walking segment from GPS to flexible start (shown as dashed line) — without this the flexible start creates a confusing dead zone at run start
- Graceful fallback with user feedback when scenic data unavailable — "No parks found nearby — showing standard route"

**Defer (v2+):**
- Nature "green score" rating — requires spatial polygon intersection analysis, disproportionate complexity
- POI labels/chips on map and route preview card — depends on Overpass being stable first
- Terrain/surface preference toggles — requires OSRM profile customization
- Full TrailRouter-style green-weighted routing engine — multi-month infrastructure project

### Architecture Approach

The core architectural principle for v1.1 is "prompt composition over pipeline branching." The existing pipeline (AI prompt -> RouteWaypoint[] -> binary search calibration -> OSRM -> render) is mode-agnostic and must not be modified for scenic modes. Two orthogonal type dimensions must be kept separate: `RouteMode` ('ai' | 'algorithmic') controls the generation engine; `ScenicMode` ('standard' | 'nature' | 'explore') controls the AI prompt flavor. Merging these into a flat enum would create combinatorial coupling. Scenic modes only apply when `routeMode === 'ai'` — the UI should gray out the toggle when algorithmic is selected.

**Major components:**
1. `RouteModeToggle.tsx` (NEW) — segmented control for Standard/Nature/Explore; pure UI, no dependencies
2. `CenterOnMeButton.tsx` (NEW) — map FAB; must integrate into a unified centering state machine (idle/centered/navigating) — not more boolean flags
3. `route-ai.ts` (MODIFY) — composable `MODE_INSTRUCTIONS` record; adds `scenicMode` and `flexibleStart` parameters; validates and clamps AI-generated start points within 300m
4. `types/index.ts` (MODIFY) — add `ScenicMode` type; extend `AppSettings` with `scenicMode` and `flexibleStart`
5. `MapView.tsx` (MODIFY) — auto-center on mount, expose flyTo for center button, unify centering state machine refactoring existing `isAutoRotating`/`showRecenter` booleans
6. `/api/pois` (NEW Next.js API route) — Overpass proxy with in-memory grid cache, 1-hour TTL, fallback behavior

**Unchanged components:** `route-osrm.ts`, `route-algorithmic.ts`, `route-visuals.ts`, `geolocation.ts`, `NavigationView.tsx`, `useRunSession.ts`, all storage/DB code.

### Critical Pitfalls

1. **LLM coordinate hallucination** — Claude Haiku invents plausible but incorrect coordinates for scenic waypoints, placing them in water, on highways, or wrong neighborhoods. Prevent by: validating all AI-generated waypoints post-generation (reject any outside route bounding box or not OSRM-routable within 500m); using real Overpass coordinates as waypoints rather than asking Claude to invent coordinates (Tier 2).

2. **Overpass rate limiting blocks route generation** — Public endpoint uses slot/cooldown model; under load, requests queue and return HTTP 429. Prevent by: server-side in-memory cache keyed on ~1km grid cells (round lat/lng to 2 decimal places, 1-hour TTL); graceful fallback to standard AI prompt when Overpass returns 429 or times out; never block route generation on POI fetch failure.

3. **GPS auto-center race condition on iOS PWA** — `getCurrentPosition` takes 2-10 seconds on iOS; permission dialog in standalone PWA mode has documented bugs where it never appears. Prevent by: caching last-known position in IndexedDB; checking `navigator.permissions.query({name:'geolocation'})` before triggering native dialog; showing custom pre-prompt; setting 5-second timeout with "Can't find your location" fallback.

4. **"Center on me" button fights existing centering code** — `MapView.tsx` already has `isAutoRotating` and `showRecenter` booleans; adding another centering concept creates ambiguous states and map jitter. Prevent by: refactoring to a unified state machine (`idle` / `centered` / `navigating`) before adding the button — not more booleans on top of booleans.

5. **Flexible start creates unrunnable first segment** — The walk from GPS position to flexible start is invisible in the current model; it can cross highways or require navigation through buildings. Prevent by: always OSRM-routing the GPS-to-start segment; showing it as a dashed "Walk to start" line; validating with OSRM walking distance (not haversine) to enforce the 300m constraint.

## Implications for Roadmap

The dependency graph dictates a clear ordering. iOS GPS permission must be fixed before auto-centering. Auto-centering must be stable before adding the "center on me" button. Type system changes must precede all feature implementation. Tier 1 scenic prompts must be validated before Tier 2 Overpass enrichment is layered on. iOS fixes are independent of scenic mode work and can be parallelized with phases that have no GPS dependency.

### Phase 1: iOS Fixes and GPS Map Centering

**Rationale:** iOS GPS permission is a prerequisite for all GPS-dependent features. The map centering state machine must be unified before adding the "center on me" button — otherwise two independent centering systems will conflict. These are highest-value, lowest-complexity improvements and are entirely independent of scenic mode work.

**Delivers:** GPS works reliably on iOS PWA; map centers on user location at app open; "center on me" button available; no Stockholm flash for non-Stockholm users; no layout issues from button/tab bar overlap; black screen on iOS Safari resolved.

**Addresses:** iOS GPS permission UX fix, map auto-center on open, "center on me" button, iOS Safari black screen, iOS layout fix.

**Avoids:** GPS centering race condition on iOS PWA (Pitfall 3); "center on me" state machine conflicts (Pitfall 4).

### Phase 2: Type System and Prompt Architecture

**Rationale:** All scenic mode features depend on `ScenicMode` type and composable prompt structure. This phase is invisible to users but unblocks Phases 3 and 4 without requiring orchestration changes mid-feature. Doing it first reduces risk of type errors propagating through multiple components simultaneously.

**Delivers:** `ScenicMode` type in `types/index.ts`; `AppSettings` extended; `route-ai.ts` refactored to composable `MODE_INSTRUCTIONS` templates; `AIRouteRequest` extended; all existing tests pass.

**Addresses:** Architecture pattern (prompt composition over pipeline branching); separation of `RouteMode` and `ScenicMode` as orthogonal axes.

**Avoids:** Merging route mode and scenic mode into flat enum (Architecture Anti-Pattern 2 from ARCHITECTURE.md).

### Phase 3: Scenic Route Modes — Tier 1 (AI Prompt)

**Rationale:** Mode toggle UI and AI prompt changes deliver immediate differentiation with low risk. Ship before adding Overpass complexity. Validate prompt quality empirically in multiple cities before building Tier 2 on top.

**Delivers:** Route mode toggle UI (Standard / Nature / Explore) on main view; Nature mode prompt producing visibly greener routes in well-mapped cities; Explore mode routing past landmarks and viewpoints; mode preference persisted in IndexedDB; scenic distance calibration validated (±15% tolerance empirically confirmed).

**Addresses:** Route mode toggle UI, Nature mode (Tier 1), Explore mode (Tier 1).

**Avoids:** Scenic distance calibration breaking with POI-attracted waypoints (Pitfall 5 from PITFALLS.md) — must be tested with 20 routes per mode before shipping.

**Research flag:** MEDIUM — Claude Haiku scenic prompt quality needs empirical validation across multiple cities; may require iterative prompt tuning.

### Phase 4: Flexible Start Point

**Rationale:** Independent of scenic mode but depends on GPS foundation (Phase 1). More complex than it appears — the walking segment routing and visual distinction are mandatory deliverables, not nice-to-haves. Flexible start is also a prerequisite for Nature mode auto-snapping to park entrances in a future iteration.

**Delivers:** Tap-to-set-start interaction within 300m radius of GPS; OSRM-routed walking segment from GPS to flexible start (shown as dashed "Walk to start" line); start point clamping when tap exceeds 300m using OSRM walking distance not haversine; reset to GPS position button; AI prompt instruction for flexible start waypoint.

**Addresses:** Flexible start point feature; walking segment routing and visual distinction.

**Avoids:** Flexible start generating unrunnable first/last segments (Pitfall 5 from PITFALLS.md).

### Phase 5: Overpass POI Enrichment — Tier 2 (Nature Mode)

**Rationale:** Only build this after Tier 1 scenic modes are validated and shipping. Overpass adds meaningful route quality improvement for well-mapped areas but introduces the most external dependency risk of any v1.1 feature. Server-side caching and fallback must be first-class requirements from the start, not added later.

**Delivers:** Next.js API route `/api/pois`; Overpass QL queries for Nature mode OSM tags (parks, water, forest, meadow, gardens); in-memory grid cache (1-hour TTL, ~1km grid cells); graceful fallback to Tier 1 AI-only prompt when Overpass fails or returns fewer than 2 POIs; user feedback when falling back; integration with waypoint generation using real POI coordinates instead of AI-invented ones.

**Addresses:** Overpass POI enrichment for Nature mode; LLM coordinate hallucination (by using real coordinates).

**Avoids:** Overpass rate limiting (Pitfall 2); OSM POI data gaps causing silent failure (Pitfall 3); LLM coordinate hallucination (Pitfall 1).

**Research flag:** HIGH — Overpass integration requires empirical testing across multiple regions including poor-coverage areas; fallback logic must be validated by disabling Overpass in devtools; OSRM `nearest` availability must be confirmed before using it for start point snapping.

### Phase Ordering Rationale

- iOS GPS must precede map auto-centering (direct dependency); centering state machine must be unified before adding "center on me" button
- Type system refactoring must precede all feature implementation (compiler dependency, reduces risk)
- Tier 1 scenic modes must precede Tier 2 Overpass enrichment (validate quality before adding complexity and failure modes)
- Flexible start is independent of scenic mode but depends on GPS stability — place after Phase 1
- Overpass phase is last: most external dependencies, most failure modes to test, most validation required

### Research Flags

Phases needing deeper research or empirical validation during planning:
- **Phase 3 (Scenic prompts):** Claude Haiku's scenic route quality is MEDIUM confidence — needs empirical prompt testing in at least 3 cities (well-mapped, average, and poorly-mapped) before considering it done. Budget 2-3 prompt iteration cycles.
- **Phase 5 (Overpass):** OSRM `nearest` service availability on public endpoint is unconfirmed — verify with a test HTTP call before designing the flexible start snapping flow. OSM coverage gaps must be validated in non-European locations.

Phases with standard patterns (research-phase not needed):
- **Phase 1 (iOS/GPS):** iOS PWA geolocation issues have known documented workarounds. MapLibre `flyTo` API is stable and well-documented.
- **Phase 2 (Types/Prompt refactor):** Pure TypeScript refactoring with no external dependencies. Patterns are clear.
- **Phase 4 (Flexible start):** Haversine + OSRM routing patterns are established; geometry is straightforward.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack validated in production. Overpass API free, well-documented, query syntax verified against official docs. Zero new npm deps confirmed by direct requirement analysis. |
| Features | HIGH | Table stakes derived from Komoot, Strava, TrailRouter, Google Maps patterns. iOS bugs are confirmed existing issues. 300m flexible start constraint from PRD. Feature priority order based on implementation dependency graph. |
| Architecture | HIGH | Based on direct codebase analysis of `route-ai.ts`, `page.tsx`, `MapView.tsx`, `types/index.ts`. Prompt composition pattern is clear and low-risk. Component boundaries cleanly defined. |
| Pitfalls | MEDIUM-HIGH | LLM hallucination sourced from peer-reviewed research (Nature 2025). Overpass rate limiting documented in official API commons. iOS PWA geolocation bug documented by Apple. OSM coverage gap from SAGE journal (22% completeness, note: focuses on private businesses; parks likely better covered). OSRM `nearest` availability is MEDIUM — spec-based inference, needs empirical verification. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **OSRM `nearest` service availability:** Verify with a test HTTP call during Phase 4 implementation. Fallback: use raw haversine offset point (OSRM `route` will snap to nearest road anyway).
- **Claude Haiku scenic prompt quality by city:** Training data quality varies significantly. Empirically test in at least 3 locations during Phase 3. If quality is insufficient for less-known cities, Tier 2 Overpass enrichment becomes higher priority.
- **Overpass regional coverage:** 22% completeness study focuses on commercial POIs; parks and natural features likely better covered but not validated. Test with US suburban and rural locations during Phase 5. Fallback behavior is mandatory before shipping.
- **Client-side API key exposure:** Existing architecture uses `anthropic-dangerous-direct-browser-access`. Documented tech debt from v1.0. Do not address in v1.1 feature phases — document and defer to a dedicated security phase.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/route-ai.ts`, `src/lib/route-osrm.ts`, `src/lib/route-algorithmic.ts`, `src/app/page.tsx`, `src/types/index.ts`, `src/components/MapView.tsx` — architecture, pipeline, existing type system
- [Overpass API Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) — API behavior, rate limits, query syntax
- [Overpass QL Reference](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) — `around:` syntax, `out center;`, timeout/maxsize parameters
- [OSM Key:leisure](https://wiki.openstreetmap.org/wiki/Key:leisure), [Key:natural](https://wiki.openstreetmap.org/wiki/Key:natural), [Key:tourism](https://wiki.openstreetmap.org/wiki/Key:tourism) — OSM tag taxonomy for Nature/Explore modes
- [How Trail Router Works](https://trailrouter.com/blog/how-trail-router-works/) — OSM-based green routing; green index, perimeter waypoints validated approach

### Secondary (MEDIUM confidence)
- [Overpass rate limit issues (GitHub)](https://github.com/drolbr/Overpass-API/issues/333) — slot/cooldown rate limiting behavior
- [LLM spatial hallucination (Nature, 2025)](https://www.nature.com/articles/s41598-025-93601-5) — LLMs assume non-existent paths, coordinate generation unreliable
- [LLM geocoding performance (GDELT)](https://blog.gdeltproject.org/generative-ai-experiments-the-surprisingly-poor-performance-of-llm-based-geocoders-geographic-bias-why-gpt-3-5-gemini-pro-outperform-gpt-4-0-in-underrepresented-geographies/) — coordinate generation unreliability by geography
- [iOS PWA geolocation bug (Apple Developer Forums)](https://developer.apple.com/forums/thread/694999) — location alert not appearing in standalone mode
- [Ride with GPS — Change Start](https://support.ridewithgps.com/hc/en-us/articles/27321702268443-Change-Start) — flexible start point UX pattern
- [Google Maps iOS SDK — My Location Button](https://developers.google.com/maps/documentation/ios-sdk/examples/enable-my-location) — "center on me" button standard pattern
- [Gaia GPS — Locate and Orient](https://help.gaiagps.com/hc/en-us/articles/360047951533-Locate-and-Orient-Yourself-on-the-Map) — three-state location button pattern (off/centered/heading-locked)

### Tertiary (LOW confidence)
- [OSM POI quality research (SAGE)](https://journals.sagepub.com/doi/10.1177/03611981231169280) — 22% completeness finding (focuses on private businesses; parks likely better covered but not validated for this study)
- OSRM `nearest` service on public endpoint — inferred from OSRM API spec; needs empirical verification before relying on it

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
