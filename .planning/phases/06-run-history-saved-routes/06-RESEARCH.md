# Phase 6: Run History & Saved Routes - Research

**Researched:** 2026-03-20
**Domain:** Client-side data views, tab navigation, IndexedDB queries, static map thumbnails
**Confidence:** HIGH

## Summary

Phase 6 introduces two new data views (run history and saved routes) plus a bottom tab navigation bar. The codebase already has all the persistence infrastructure needed: `dbGetAllByIndex` for sorted run fetching, `getSavedRoutes`/`saveRoute`/`deleteRoute` for route CRUD, and the `CompletedRun` / `SavedRoute` types. The existing `HistoryView.tsx` is a legacy saved-routes viewer (not a run history view) that needs to be repurposed or replaced.

The main technical challenges are: (1) rendering mini-map thumbnails for cards without spawning heavy MapLibre instances per list item, (2) evolving the `AppView` type and `page.tsx` routing from overlay-based to tab-based navigation, and (3) adding a `name` field to `SavedRoute` plus inline editing support.

**Primary recommendation:** Build tab bar as a simple fixed-bottom component, render route thumbnails using a single shared offscreen MapLibre instance or canvas-based polyline drawing, and reuse the established card + dialog patterns from RunSummaryView and DiscardConfirmDialog.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Card-based list sorted by date (newest first) -- each card shows: date, distance, time, pace, route thumbnail
- Route thumbnail is a static mini-map image generated from GPS trace polyline at list render time
- Tapping a card opens full-screen overlay with MapView showing GPS trace + planned route, all stats, delete button
- Delete uses confirmation dialog matching DiscardConfirmDialog pattern from Phase 5
- Save route from the route generator after generation (before starting a run) -- "Save Route" button
- Auto-generated name from date + distance (e.g., "5.2 km route - Mar 20") with option to edit inline
- Saved routes list uses same card pattern as history -- name, distance, thumbnail, "Run" button
- Tap "Run" on saved route loads route onto map and starts navigation immediately
- Bottom tab bar with 3 tabs: Map (route generator), History, Routes -- always visible except during active run
- Fixed bottom bar, dark theme, icon + label per tab, green-400 accent on active tab
- Empty state for history: "No runs yet -- complete your first run to see it here"
- Empty state for saved routes: "No saved routes -- generate a route and tap Save to add it here"

### Claude's Discretion
- Card visual design (borders, shadows, spacing within dark theme)
- Tab bar icons selection (SVG or emoji)
- Mini-map thumbnail rendering approach (canvas snapshot vs static image)
- Run detail overlay layout specifics
- Saved route name editing UX details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-01 | History view lists all past runs sorted by date (newest first) | `dbGetAllByIndex('runs', 'startTime', 'prev')` returns CompletedRun[] sorted by startTime descending. Filter out snapshots via `endTime` presence. |
| HIST-02 | Each history entry shows date, distance, time, pace, and small route thumbnail | `formatPace`, `formatMetricDistance`, `formatElapsed` from metrics.ts. Thumbnail via canvas polyline rendering. |
| HIST-03 | User can tap a past run to see full details and route on map | Reuse MapLibre dual-polyline pattern from RunSummaryView.tsx (planned route + GPS trace). |
| HIST-04 | User can delete individual runs from history | `dbDelete('runs', id)` already exists. Confirmation dialog reuses DiscardConfirmDialog pattern. |
| ROUT-01 | User can save a generated route as a favorite | `saveRoute(route, city)` exists in storage.ts. Need to add `name` field to SavedRoute and expose "Save Route" button in route preview bar. |
| ROUT-02 | List of saved routes with name, distance, and thumbnail | `getSavedRoutes()` returns SavedRoute[]. Same card pattern and thumbnail approach as history. |
| ROUT-03 | User can re-run a saved route (load onto map and start navigation) | Already implemented in HistoryView via `onLoadRoute` callback. Extend to auto-start navigation. |
| ROUT-04 | User can rename saved routes | Add inline text input on card. `dbPut('routes', updatedRoute)` to persist rename. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI components | Already in project |
| Next.js | 16.2.0 | Framework | Already in project |
| maplibre-gl | 5.20.2 | Map rendering for detail views | Already in project |
| Tailwind CSS | 4.x | Styling | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fake-indexeddb | 6.2.5 | Test IndexedDB operations | Unit tests for history/route CRUD |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas polyline thumbnails | MapLibre static instances per card | MapLibre is ~2MB per instance, canvas is lightweight; canvas wins for lists |
| Custom tab bar | React Navigation / headless UI lib | No dependency needed for 3 static tabs |

**Installation:**
No new dependencies required. All needed libraries are already installed.

## Architecture Patterns

### Recommended Component Structure
```
src/
  components/
    TabBar.tsx              # Bottom tab bar (Map, History, Routes)
    RunHistoryView.tsx      # Run history list view (replaces current HistoryView purpose)
    RunDetailOverlay.tsx    # Full-screen run detail with map
    SavedRoutesView.tsx     # Saved routes list view
    DeleteRunDialog.tsx     # Confirmation dialog for run deletion
    RouteThumbnail.tsx      # Canvas-based route polyline thumbnail
  types/
    index.ts                # Add 'routes' to AppView, add name to SavedRoute
```

### Pattern 1: Tab-Based Navigation
**What:** Replace overlay-based view switching with a persistent bottom tab bar that controls `AppView` state.
**When to use:** Always visible except during active run (`navigate` view) and summary view.
**Example:**
```typescript
// AppView type evolution
export type AppView = 'generate' | 'history' | 'routes' | 'map' | 'navigate' | 'settings' | 'summary';

// Tab bar maps to three primary views
const TAB_VIEWS = ['generate', 'history', 'routes'] as const;

// Tab bar visibility logic
const showTabBar = TAB_VIEWS.includes(view as any) || view === 'map';
```

### Pattern 2: Canvas-Based Route Thumbnail
**What:** Render GPS trace polyline onto a small HTML5 canvas element without MapLibre overhead.
**When to use:** List views where many thumbnails render simultaneously.
**Example:**
```typescript
// Given polyline as [lng, lat][] or trace as FilteredPosition[]
// 1. Compute bounding box
// 2. Project to canvas coordinates with padding
// 3. Draw stroke path with green-400 color (#4ade80)
// Canvas size: ~80x80px or ~100x60px per card
```

### Pattern 3: Data Loading Pattern
**What:** useEffect + useState for async IndexedDB data loading, matching established codebase pattern.
**When to use:** All views that load from IndexedDB.
**Example:**
```typescript
const [runs, setRuns] = useState<CompletedRun[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  dbGetAllByIndex<CompletedRun>('runs', 'startTime', 'prev')
    .then((all) => {
      // Filter out snapshots (incomplete runs without endTime)
      setRuns(all.filter((r) => 'endTime' in r));
    })
    .finally(() => setLoading(false));
}, []);
```

### Pattern 4: SavedRoute Name Extension
**What:** Add optional `name` field to SavedRoute interface, auto-generate from distance + date.
**When to use:** When saving a route and displaying in saved routes list.
**Example:**
```typescript
export interface SavedRoute {
  id: string;
  name?: string;          // NEW: user-editable name
  route: GeneratedRoute;
  city: string;
  createdAt: string;
}

// Auto-generate name
function generateRouteName(route: GeneratedRoute): string {
  const km = (route.distance / 1000).toFixed(1);
  const date = new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return `${km} km route - ${date}`;
}
```

### Anti-Patterns to Avoid
- **MapLibre instance per list item:** Each MapLibre Map instance is heavy. Never create one per card in a scrollable list. Use canvas for thumbnails.
- **Synchronous IndexedDB calls in HistoryView:** The current HistoryView calls `getSavedRoutes()` synchronously (broken since storage.ts was made async in Phase 1). All calls must be awaited.
- **Mixing run snapshots with completed runs:** The 'runs' store contains both ActiveRunSnapshot (crash recovery) and CompletedRun records. Always filter by `endTime` presence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting | Custom date parser | `toLocaleDateString` with Intl options | Already used in codebase (sv-SE locale in HistoryView) |
| Distance/pace formatting | New format functions | `formatMetricDistance`, `formatPace`, `formatElapsed` from metrics.ts | Tested and unit-aware |
| IndexedDB CRUD | New storage abstraction | Existing `dbGet`, `dbPut`, `dbDelete`, `dbGetAll`, `dbGetAllByIndex` from db.ts | Already handles connection, versioning, migrations |
| Confirmation dialogs | New dialog from scratch | Clone DiscardConfirmDialog pattern | Consistent UX, proven pattern |

**Key insight:** Nearly all data access and formatting utilities already exist. This phase is primarily a UI composition task using existing infrastructure.

## Common Pitfalls

### Pitfall 1: Stale HistoryView References
**What goes wrong:** The existing `HistoryView.tsx` calls `getSavedRoutes()` synchronously (`setRoutes(getSavedRoutes())`) but the function is async since Phase 1 migration.
**Why it happens:** HistoryView was written pre-async migration and never updated.
**How to avoid:** The new RunHistoryView and SavedRoutesView must always `await` or `.then()` async storage calls.
**Warning signs:** Empty list despite data in IndexedDB, TypeScript type error on Promise assignment.

### Pitfall 2: Run vs Snapshot Confusion
**What goes wrong:** Displaying crash recovery snapshots as completed runs in the history list.
**Why it happens:** Both `ActiveRunSnapshot` and `CompletedRun` are stored in the 'runs' object store.
**How to avoid:** Filter with `'endTime' in run` -- only CompletedRun has endTime.
**Warning signs:** History entries with missing time/pace values, entries appearing and disappearing.

### Pitfall 3: Tab Bar Z-Index Conflicts
**What goes wrong:** Tab bar renders on top of overlays (navigation, summary) or behind the map.
**Why it happens:** Existing views use various z-index levels (z-20 for route bar, z-30 for overlays, z-50 for dialogs).
**How to avoid:** Tab bar at z-20 with conditional rendering: hide during `navigate`, `summary`, and `settings` views.
**Warning signs:** Tab bar visible over run navigation UI, or invisible under map.

### Pitfall 4: Missing Route Data on CompletedRun
**What goes wrong:** History detail view cannot show the planned route polyline because CompletedRun only stores `routeId`, not the full route.
**Why it happens:** CompletedRun has `routeId: string | null` referencing a SavedRoute, but the route may have been deleted.
**How to avoid:** When showing run detail, attempt to load the route via `dbGet('routes', routeId)`. If missing, show only the GPS trace. Consider also storing the route polyline directly on CompletedRun (schema addition).
**Warning signs:** Blank planned route line in detail view for older runs.

### Pitfall 5: Large GPS Traces in List View
**What goes wrong:** Loading all CompletedRun records with full trace arrays causes slow rendering.
**Why it happens:** Each trace can contain hundreds of FilteredPosition objects.
**How to avoid:** Load all runs for list display (IndexedDB handles this fine for reasonable run counts). For thumbnail rendering, simplify the trace to fewer points using every-Nth sampling.
**Warning signs:** Sluggish scrolling on history list with 50+ runs.

## Code Examples

### Fetching Sorted Run History
```typescript
// Source: db.ts dbGetAllByIndex with 'startTime' index, direction 'prev'
import { dbGetAllByIndex } from '@/lib/db';
import type { CompletedRun, Run } from '@/types';

async function loadRunHistory(): Promise<CompletedRun[]> {
  const allRuns = await dbGetAllByIndex<Run>('runs', 'startTime', 'prev');
  // Filter out crash recovery snapshots
  return allRuns.filter((r): r is CompletedRun => 'endTime' in r);
}
```

### Canvas Polyline Thumbnail
```typescript
// Render a GPS trace or route polyline onto a canvas
function drawPolylineThumbnail(
  canvas: HTMLCanvasElement,
  points: { lat: number; lng: number }[],
  color: string = '#4ade80'
) {
  if (points.length < 2) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const pad = 8;

  // Compute bounds
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  // Project to canvas
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  for (let i = 0; i < points.length; i++) {
    const x = pad + ((points[i].lng - minLng) / lngRange) * (w - 2 * pad);
    const y = pad + ((maxLat - points[i].lat) / latRange) * (h - 2 * pad);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
```

### Tab Bar Component
```typescript
// Fixed bottom tab bar, dark theme, green-400 active accent
interface TabBarProps {
  activeTab: 'generate' | 'history' | 'routes';
  onTabChange: (tab: 'generate' | 'history' | 'routes') => void;
}

// Render as fixed bottom bar at z-20
// Each tab: icon (SVG) + label, text-gray-500 inactive, text-green-400 active
// bg-gray-900 border-t border-gray-800
// Hide when view is 'navigate', 'summary', or 'settings'
```

### Inline Name Editing
```typescript
// Pattern: click label to toggle to input, blur/enter to save
const [editing, setEditing] = useState(false);
const [name, setName] = useState(savedRoute.name || generateRouteName(savedRoute.route));

const handleSave = async () => {
  setEditing(false);
  await dbPut('routes', { ...savedRoute, name });
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HistoryView shows saved routes | HistoryView must show completed runs | Phase 6 | Complete rewrite of HistoryView |
| Overlay-based view switching | Tab-based primary navigation | Phase 6 | AppView type expands, page.tsx restructured |
| Auto-save all generated routes | Explicit "Save Route" button | Phase 6 | Route saving moves from handleGenerate to user action |

**Deprecated/outdated:**
- Current `HistoryView.tsx`: Uses synchronous `getSavedRoutes()` call (broken), shows saved routes not run history. Must be replaced entirely.
- Current auto-save in `handleGenerate`: `saveRoute(generatedRoute, cityName)` is called automatically on every generation. This should be removed; saving becomes explicit via a "Save Route" button.

## Open Questions

1. **Route polyline storage on CompletedRun**
   - What we know: CompletedRun has `routeId` but not the route polyline itself. If the saved route is deleted, the planned route cannot be shown in run detail.
   - What's unclear: Whether to add a `routePolyline` field to CompletedRun or accept graceful degradation.
   - Recommendation: Store the route polyline on CompletedRun at run completion time. This is a small schema addition that ensures history is self-contained. No DB version bump needed since IndexedDB is schema-flexible.

2. **SavedRoute name field migration**
   - What we know: Existing SavedRoute records lack a `name` field. Making it optional (`name?: string`) handles this gracefully.
   - What's unclear: Whether existing saved routes should get auto-generated names on first load.
   - Recommendation: Make `name` optional. Display fallback `${distance} km route - ${date}` when undefined. No migration needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIST-01 | Load and sort completed runs from IndexedDB | unit | `npx vitest run src/lib/__tests__/history.test.ts -t "loads sorted" -x` | No - Wave 0 |
| HIST-02 | Format run stats (date, distance, time, pace) | unit | `npx vitest run src/lib/__tests__/metrics.test.ts -x` | Yes (metrics) |
| HIST-03 | Run detail displays trace and planned route | manual-only | N/A - requires MapLibre rendering | N/A |
| HIST-04 | Delete run from IndexedDB | unit | `npx vitest run src/lib/__tests__/history.test.ts -t "delete" -x` | No - Wave 0 |
| ROUT-01 | Save route with name | unit | `npx vitest run src/lib/__tests__/storage-routes.test.ts -t "save" -x` | No - Wave 0 |
| ROUT-02 | List saved routes with metadata | unit | `npx vitest run src/lib/__tests__/storage-routes.test.ts -t "list" -x` | No - Wave 0 |
| ROUT-03 | Load saved route (callback integration) | manual-only | N/A - requires UI interaction | N/A |
| ROUT-04 | Rename saved route | unit | `npx vitest run src/lib/__tests__/storage-routes.test.ts -t "rename" -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/history.test.ts` -- covers HIST-01, HIST-04 (run history load/sort/delete)
- [ ] `src/lib/__tests__/storage-routes.test.ts` -- covers ROUT-01, ROUT-02, ROUT-04 (route save/list/rename)
- [ ] Existing `src/lib/__tests__/db.test.ts` and `src/lib/__tests__/metrics.test.ts` cover supporting infrastructure

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/lib/db.ts`, `src/lib/storage.ts`, `src/types/index.ts`, `src/app/page.tsx` -- direct code inspection
- Project codebase: `src/components/RunSummaryView.tsx` -- MapLibre dual-polyline pattern
- Project codebase: `src/components/DiscardConfirmDialog.tsx` -- confirmation dialog pattern
- Project codebase: `src/components/HistoryView.tsx` -- current (broken) implementation to replace

### Secondary (MEDIUM confidence)
- Canvas 2D API for polyline thumbnail rendering -- well-established browser API, no verification needed

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - all patterns derived from existing codebase inspection
- Pitfalls: HIGH - identified from direct code analysis (async bug in HistoryView, snapshot/run confusion in DB)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable - no external dependencies changing)
