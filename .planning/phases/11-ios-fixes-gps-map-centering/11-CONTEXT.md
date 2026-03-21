# Phase 11: iOS Fixes & GPS Map Centering - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix iOS Safari rendering issues and implement GPS-based map centering with a state machine. IOS-01, IOS-02, IOS-03 are pre-completed (already committed). Active scope is MAP-01 (auto-center on GPS), MAP-02 ("center on me" button), MAP-03 (centering state machine with free-pan/centered/navigation states).

</domain>

<decisions>
## Implementation Decisions

### Initial map centering (MAP-01)
- On app open, Claude decides the best pre-GPS-lock UX (e.g., last known location from IndexedDB, loading state, or zoomed-out view)
- When GPS locks, smooth flyTo() animation (~1.5s) to user position — polished feel like Google Maps
- Default idle zoom level: 15 (~500m visible radius)
- Map stays north-up in idle mode; heading-up only during active navigation
- No Stockholm hardcode flash — must show something sensible before GPS lock

### Center-on-me button (MAP-02)
- Claude's Discretion — button placement, visual style, and tap behavior
- Should be visible on the map in non-navigation states
- Existing recenter button in NavigationView can inform the pattern

### Centering state machine (MAP-03)
- Claude's Discretion — state definitions, transitions, and timeouts
- Must support at minimum: auto-center (following GPS), free-pan (user dragged map), navigation-tracking (heading-up during active run)
- Free-pan should return to idle naturally or via center button
- Navigation mode should auto-rotate with heading (existing pattern in MapView.tsx)

### Claude's Discretion
- Pre-GPS-lock UX approach (last known location vs loading overlay vs zoomed-out)
- Center-on-me button placement and visual design
- State machine implementation details (state names, transition triggers, timeouts)
- Loading indicator design during GPS acquisition
- Error/fallback behavior when GPS is denied or unavailable

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Map & GPS implementation
- `src/components/MapView.tsx` — Current map component with handleRecenter(), centerOnUser(), user marker, heading-aware easeTo()
- `src/components/NavigationView.tsx` — Active run UI with auto-rotation and manual pan detection
- `src/lib/geolocation.ts` — GPS API wrapper with watchPosition(), getCurrentPosition()
- `src/lib/gps-filter.ts` — watchFilteredPosition() with accuracy/jitter/teleport gates
- `src/lib/navigation.ts` — bearingBetween(), smoothHeading(), navigation math

### iOS & PWA
- `src/app/layout.tsx` — Viewport + metadata config, safe area setup
- `src/app/globals.css` — Safe area CSS variables, iOS-specific styles
- `public/sw.js` — Service worker caching strategies

### State management patterns
- `src/hooks/useRunSession.ts` — useReducer pattern for complex state (reference for state machine approach)

### Requirements
- `.planning/REQUIREMENTS.md` — MAP-01, MAP-02, MAP-03 acceptance criteria
- `.planning/ROADMAP.md` — Phase 11 success criteria and dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `watchFilteredPosition()` in gps-filter.ts — ready to use for GPS tracking, no changes needed
- `handleRecenter()` / `centerOnUser()` in MapView.tsx — existing recenter patterns to extend
- User marker (16px blue circle with white border and glow) — already rendered on map
- `easeTo()` / `flyTo()` animation patterns — established in MapView.tsx
- `useRunSession` useReducer pattern — reference for building centering state machine

### Established Patterns
- Coordinate convention: [lng, lat] pairs throughout (MapLibre convention)
- Default center: Stockholm [18.0686, 59.3293] — this is the hardcode to replace
- Map dark theme: CartoDB dark-matter vector tiles via DARK_STYLE constant
- iOS safe area insets via env() CSS variables
- ResizeObserver for iOS Safari map container sizing

### Integration Points
- MapView.tsx is the primary integration point — centering logic lives here
- NavigationView.tsx owns heading-up rotation during active runs
- IndexedDB (via db.ts/storage.ts) for persisting last known position
- Page.tsx orchestrates MapView vs NavigationView states

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred most decisions to Claude's discretion, with the key constraint being: smooth flyTo animation on GPS lock, zoom 15 default, north-up in idle mode.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-ios-fixes-gps-map-centering*
*Context gathered: 2026-03-21*
