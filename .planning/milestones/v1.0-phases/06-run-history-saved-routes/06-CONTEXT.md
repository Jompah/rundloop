# Phase 6: Run History & Saved Routes - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver run history browsing (list past runs, view details, delete) and saved routes management (save from generator, list, load for navigation). Introduces a 3-tab bottom navigation bar for the app.

</domain>

<decisions>
## Implementation Decisions

### Run History View
- Card-based list sorted by date (newest first) — each card shows: date, distance, time, pace, route thumbnail
- Route thumbnail is a static mini-map image generated from GPS trace polyline at list render time
- Tapping a card opens full-screen overlay with MapView showing GPS trace + planned route, all stats, delete button
- Delete uses confirmation dialog matching DiscardConfirmDialog pattern from Phase 5

### Saved Routes
- Save route from the route generator after generation (before starting a run) — "Save Route" button
- Auto-generated name from date + distance (e.g., "5.2 km route - Mar 20") with option to edit inline
- Saved routes list uses same card pattern as history — name, distance, thumbnail, "Run" button
- Tap "Run" on saved route loads route onto map and starts navigation immediately

### Navigation & Tab Structure
- Bottom tab bar with 3 tabs: Map (route generator), History, Routes — always visible except during active run
- Fixed bottom bar, dark theme, icon + label per tab, green-400 accent on active tab
- Empty state for history: "No runs yet — complete your first run to see it here"
- Empty state for saved routes: "No saved routes — generate a route and tap Save to add it here"

### Claude's Discretion
- Card visual design (borders, shadows, spacing within dark theme)
- Tab bar icons selection (SVG or emoji)
- Mini-map thumbnail rendering approach (canvas snapshot vs static image)
- Run detail overlay layout specifics
- Saved route name editing UX details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CompletedRun` type with id, startTime, endTime, elapsedMs, distanceMeters, trace, routeId
- `db.ts`: `dbGetAll('runs')`, `dbGet()`, `dbDelete()`, `dbGetAllByIndex()` for IndexedDB
- `storage.ts`: `getSavedRoutes()`, `saveRoute()`, `deleteRoute()` already exist
- `metrics.ts`: `formatPace()`, `formatMetricDistance()`, `formatElapsed()`, `computeAveragePace()`
- `MapView.tsx`: Route rendering, user location, polyline layers
- `DiscardConfirmDialog.tsx`: Established confirmation dialog pattern
- `RunSummaryView.tsx`: MapLibre dual polyline pattern (route + trace)

### Established Patterns
- Dark theme: bg-gray-900, text-white, green-400 accent
- View switching in page.tsx via AppView state type
- Card patterns established in settings and dialogs
- IndexedDB for all persistence
- Tailwind 4 utility classes

### Integration Points
- `AppView` type needs 'history' and 'routes' values added
- `page.tsx` needs tab bar component and view routing for history/routes
- Route saving needs a `SavedRoute` type (may already exist in storage.ts)
- History needs to load all CompletedRun records from IndexedDB

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
