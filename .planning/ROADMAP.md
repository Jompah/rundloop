# Roadmap: Rundloop

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-03-21)
- [ ] **v1.1 Route Quality & Map UX** - Phases 11-15 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-10) - SHIPPED 2026-03-21</summary>

- [x] Phase 1: Storage & GPS Foundation (5/5 plans) - completed 2026-03-20
- [x] Phase 2: Run Session Lifecycle (2/2 plans) - completed 2026-03-20
- [x] Phase 3: Live Run Metrics (2/2 plans) - completed 2026-03-20
- [x] Phase 4: Navigation Polish (3/3 plans) - completed 2026-03-20
- [x] Phase 5: Run Summary (2/2 plans) - completed 2026-03-20
- [x] Phase 6: Run History & Saved Routes (5/5 plans) - completed 2026-03-20
- [x] Phase 7: Route Visualization (3/3 plans) - completed 2026-03-20
- [x] Phase 8: UI/UX & PWA Polish (3/3 plans) - completed 2026-03-20
- [x] Phase 9: Cross-Phase Wiring Fixes (2/2 plans) - completed 2026-03-20
- [x] Phase 10: PWA Completion (1/1 plan) - completed 2026-03-20

</details>

### v1.1 Route Quality & Map UX

- [x] **Phase 11: iOS Fixes & GPS Map Centering** - Fix iOS rendering/layout/GPS bugs and add map centering with unified state machine
- [ ] **Phase 12: Route Mode Architecture** - Add scenic mode type system, UI toggle, and composable AI prompt structure
- [ ] **Phase 13: Scenic Route Modes** - Nature mode produces greener routes, Explore mode routes past landmarks
- [ ] **Phase 14: Flexible Start Point** - Route can start within 300m of GPS with visible walking segment
- [ ] **Phase 15: Overpass POI Enrichment** - Real POI coordinates from Overpass API replace AI-invented waypoints for Nature mode

## Phase Details

### Phase 11: iOS Fixes & GPS Map Centering
**Goal**: Users on iOS see a working map centered on their location with a reliable GPS permission flow
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: IOS-01, IOS-02, IOS-03, MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Map centers on user GPS position when the app opens (no Stockholm hardcode flash for non-Stockholm users)
  2. User can tap a "center on me" button to re-center the map on their current GPS position at any time
  3. Map centering behaves correctly across states: free-pan returns to idle, center button snaps back, navigation mode auto-rotates with heading
  4. iOS Safari renders the map without a black screen, buttons do not overlap the tab bar, and GPS permission is requested explicitly with retry option
**Plans:** 2 plans
Plans:
- [ ] 11-01-PLAN.md — TDD: centering state machine reducer and useMapCentering hook
- [ ] 11-02-PLAN.md — Wire centering hook into MapView and page.tsx, replace Stockholm hardcode

Note: IOS-01, IOS-02, IOS-03 are pre-completed (already committed to codebase). Remaining scope is MAP-01, MAP-02, MAP-03.

### Phase 12: Route Mode Architecture
**Goal**: The type system and prompt pipeline support scenic route modes without modifying the existing generation pipeline
**Depends on**: Phase 11
**Requirements**: ROUTE-01, ROUTE-04
**Success Criteria** (what must be TRUE):
  1. User sees a Standard / Nature / Explore toggle on the main map view (disabled when algorithmic mode is selected)
  2. Selecting a route mode persists the preference in IndexedDB and the AI prompt adapts waypoint selection instructions to the chosen mode
  3. Existing route generation in standard mode produces identical results to pre-change behavior (no regressions)
**Plans**: TBD

### Phase 13: Scenic Route Modes
**Goal**: Nature and Explore modes produce visibly different routes that match their scenic intent
**Depends on**: Phase 12
**Requirements**: ROUTE-02, ROUTE-03
**Success Criteria** (what must be TRUE):
  1. Nature mode generates routes that visibly favor parks, waterfronts, and green areas compared to Standard mode for the same start point and distance
  2. Explore mode generates routes that pass landmarks, viewpoints, or touristy areas compared to Standard mode for the same start point and distance
  3. Both scenic modes produce runnable loop routes that meet the distance tolerance (within 15% of requested distance)
**Plans**: TBD

### Phase 14: Flexible Start Point
**Goal**: Users can start a route from a nearby optimal point rather than their exact GPS location
**Depends on**: Phase 11
**Requirements**: START-01, START-02
**Success Criteria** (what must be TRUE):
  1. Generated route can start at a point up to 300m from the user GPS position (using OSRM walking distance, not haversine)
  2. A dashed "walk to start" segment is visible on the map from GPS position to route start point
  3. If the AI selects a start point beyond 300m, it is clamped to within the allowed radius
**Plans**: TBD

### Phase 15: Overpass POI Enrichment
**Goal**: Nature mode routes use real POI coordinates from OpenStreetMap instead of AI-invented waypoints
**Depends on**: Phase 13
**Requirements**: ROUTE-05, ROUTE-06, ROUTE-07
**Success Criteria** (what must be TRUE):
  1. Nature mode route generation queries Overpass API for nearby parks, water features, and green spaces, using real coordinates as waypoints
  2. POI responses are cached server-side by grid cell (approximately 1km, 1-hour TTL) to avoid Overpass rate limits
  3. When Overpass returns fewer than 2 POIs or fails entirely, the app falls back to Tier 1 AI-only routing and shows user feedback ("No parks found nearby -- showing standard route")
  4. Route generation never blocks or fails due to Overpass unavailability
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 12 -> 13 -> 14 -> 15
Note: Phase 14 depends on Phase 11 (not 13), so it could run in parallel with 12/13 if needed.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10 | v1.0 | 28/28 | Complete | 2026-03-21 |
| 11. iOS Fixes & GPS Map Centering | v1.1 | 0/2 | Planning | - |
| 12. Route Mode Architecture | v1.1 | 0/? | Not started | - |
| 13. Scenic Route Modes | v1.1 | 0/? | Not started | - |
| 14. Flexible Start Point | v1.1 | 0/? | Not started | - |
| 15. Overpass POI Enrichment | v1.1 | 0/? | Not started | - |

_Full v1.0 details: .planning/milestones/v1.0-ROADMAP.md_
