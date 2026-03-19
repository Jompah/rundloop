# Architecture Patterns

**Domain:** Running PWA with GPS navigation, live metrics, route visualization, and data persistence
**Researched:** 2026-03-19

## Current Architecture (As-Is)

The existing codebase is a single-page Next.js app with all state managed in the root `page.tsx` component. The architecture is flat: one god component (`Home`) owns all state and passes it down to view components (`MapView`, `RouteGenerator`, `NavigationView`, `SettingsView`, `HistoryView`). There is no run session model, no structured metrics computation, and persistence uses `localStorage` (not IndexedDB).

```
Current flow:
  page.tsx (god component, all state)
    |-- MapView (renders map, receives route + location)
    |-- RouteGenerator (UI for distance selection, triggers generation)
    |-- NavigationView (turn-by-turn overlay, basic step tracking)
    |-- SettingsView / HistoryView (simple overlays)

  lib/geolocation.ts  -- GPS via navigator.geolocation
  lib/route-ai.ts     -- AI waypoint generation
  lib/route-algorithmic.ts -- Geometric waypoint patterns
  lib/route-osrm.ts   -- OSRM routing (waypoints -> polyline + instructions)
  lib/storage.ts       -- localStorage for settings + route history
  lib/voice.ts         -- Web Speech API wrapper
```

### Key Problems in Current Architecture

1. **No run session lifecycle.** Navigation starts/stops but nothing tracks elapsed time, GPS trace, pace, or distance covered. The `totalCovered` in `NavigationView` is a rough estimate from start-point distance, not accumulated GPS trace.
2. **localStorage will hit limits.** GPS traces for runs (hundreds of coordinates per run) will exceed localStorage's ~5MB limit quickly.
3. **All computation on main thread.** GPS processing, distance calculations, and pace averaging all happen in React render cycles.
4. **No offline resilience.** No service worker for app shell caching. GPS tracking dies if the tab backgrounds on iOS.
5. **MapView has no heading rotation or route progress visualization.**

## Recommended Architecture (To-Be)

### High-Level Component Architecture

```
page.tsx (thin shell: view routing + context providers)
  |
  |-- RunSessionProvider (context)
  |     |-- manages: RunSession state machine
  |     |-- owns: GPS subscription lifecycle
  |     |-- computes: live metrics (pace, distance, elapsed)
  |     |-- persists: completed runs to IndexedDB
  |
  |-- MapController (context, wraps MapView)
  |     |-- manages: map instance ref
  |     |-- handles: route rendering, user marker, heading rotation
  |     |-- exposes: fitToRoute(), centerOnUser(), setHeading()
  |
  |-- Views (swap based on AppView state)
        |-- GenerateView (route generation UI)
        |-- PreRunView (route preview, start button)
        |-- ActiveRunView (live metrics overlay + map)
        |-- RunSummaryView (post-run stats, save/discard)
        |-- HistoryView (past runs with thumbnails)
        |-- SettingsView
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **RunSessionProvider** | Run lifecycle state machine (idle -> active -> paused -> completed). Owns GPS subscription, computes metrics, records GPS trace. | GPS Engine, MetricsCalculator, RunStorage, MapController |
| **GPS Engine** (`lib/gps-engine.ts`) | Wraps `navigator.geolocation.watchPosition` with filtering (accuracy threshold, minimum distance delta, speed sanity checks). Emits clean `GeoPosition` events. | RunSessionProvider |
| **MetricsCalculator** (`lib/metrics.ts`) | Pure functions: compute pace from GPS trace, rolling average pace, total distance from coordinate array, split times per km. No state. | RunSessionProvider (called per GPS tick) |
| **MapController** | Holds MapLibre map instance. Exposes imperative methods for route drawing, gradient rendering, heading rotation, progress visualization, user marker updates. | RunSessionProvider (receives location + heading), Views (trigger fit/center) |
| **RunStorage** (`lib/run-storage.ts`) | IndexedDB wrapper for completed runs. Stores GPS traces, metrics snapshots, route data. Handles migration from localStorage. | RunSessionProvider (on run complete), HistoryView (queries) |
| **RouteStorage** (`lib/route-storage.ts`) | IndexedDB wrapper for generated/saved routes. Replaces current localStorage route history. | GenerateView, HistoryView |
| **NavigationEngine** (`lib/navigation.ts`) | Determines current step from GPS position vs. route instructions. Off-route detection. Distance to next turn. | RunSessionProvider (receives GPS, emits navigation state) |
| **VoiceEngine** (`lib/voice.ts`) | Web Speech API wrapper (already exists). Extended with distance milestone announcements. | NavigationEngine (triggers on step change), RunSessionProvider (triggers on km milestone) |
| **WakeLockManager** (`lib/wake-lock.ts`) | Acquires/releases Screen Wake Lock. Re-acquires on visibility change. | RunSessionProvider (acquire on run start, release on run end) |
| **ServiceWorker** (`public/sw.js`) | Caches app shell for offline loading. Does NOT handle GPS (not possible in service worker on iOS). | Registered on app mount |

### Data Flow

#### Route Generation Flow (existing, minor changes)

```
User selects distance
  -> RouteGenerator calls onGenerate(distance)
  -> page.tsx dispatches to route-ai.ts or route-algorithmic.ts
  -> Waypoints generated
  -> routeViaOSRM(waypoints) -> polyline + instructions
  -> Route stored in state + RouteStorage (IndexedDB)
  -> MapController renders route on map
  -> View switches to PreRunView
```

#### Active Run Flow (new, core of this milestone)

```
User taps "Start Run"
  -> RunSessionProvider transitions: idle -> active
  -> WakeLockManager.acquire()
  -> GPS Engine starts watchPosition (high accuracy)
  -> On each GPS tick:
       1. GPS Engine filters (accuracy > 30m? discard. < 2m moved? discard.)
       2. RunSessionProvider appends to GPS trace array
       3. MetricsCalculator.computeDistance(trace) -> total distance
       4. MetricsCalculator.computePace(trace, window=30s) -> current pace
       5. MetricsCalculator.computeElapsed(startTime) -> elapsed time
       6. NavigationEngine.update(position, route) -> current step, distance to next
       7. State update -> ActiveRunView re-renders metrics overlay
       8. MapController.updateUserPosition(pos, heading)
       9. If heading available: MapController.rotateToBearing(heading)

User taps "Pause"
  -> RunSessionProvider transitions: active -> paused
  -> GPS Engine continues (lower frequency or stop, configurable)
  -> Timer pauses
  -> Metrics freeze

User taps "Resume"
  -> RunSessionProvider transitions: paused -> active
  -> Timer resumes from paused elapsed

User taps "End Run"
  -> RunSessionProvider transitions: active/paused -> completed
  -> WakeLockManager.release()
  -> GPS Engine stops
  -> Final metrics computed
  -> View switches to RunSummaryView
  -> User chooses Save or Discard
  -> If Save: RunStorage.saveRun(session) -> IndexedDB
```

#### Data Persistence Flow

```
Active Run:
  GPS ticks -> appended to in-memory array (RunSessionProvider state)
  Every 30s: snapshot to IndexedDB (crash recovery)

Run Complete:
  Full GPS trace + metrics -> IndexedDB "runs" object store
  Route data -> IndexedDB "routes" object store (if not already saved)

History Query:
  HistoryView -> RunStorage.getRecentRuns() -> IndexedDB query
  Each run has: id, date, distance, duration, pace, route reference, gps_trace
```

### Key Data Models

```typescript
// Run session state machine
type RunState = 'idle' | 'active' | 'paused' | 'completed';

interface RunSession {
  id: string;
  state: RunState;
  routeId: string;          // reference to generated route
  startedAt: number;        // timestamp
  pausedDuration: number;   // total ms spent paused
  gpsTrace: GeoPosition[];  // full GPS recording
  splits: SplitTime[];      // per-km splits
}

interface LiveMetrics {
  elapsedTime: number;      // ms (excluding paused time)
  totalDistance: number;     // meters (from GPS trace)
  currentPace: number;      // seconds per km (rolling 30s window)
  averagePace: number;      // seconds per km (overall)
  remainingDistance: number; // meters (route distance - covered)
}

interface SplitTime {
  km: number;               // which kilometer (1, 2, 3...)
  time: number;             // elapsed time at this km mark
  pace: number;             // pace for this km segment
}

interface CompletedRun {
  id: string;
  date: string;             // ISO date
  routeId: string;
  distance: number;         // meters
  duration: number;         // ms (active time)
  averagePace: number;      // seconds per km
  splits: SplitTime[];
  gpsTrace: [number, number][]; // [lng, lat] pairs (compressed)
  routeSnapshot: {          // denormalized for history display
    polyline: [number, number][];
    city: string;
  };
}
```

### IndexedDB Schema

```
Database: "rundloop"
Version: 1

Object Stores:
  "runs"     - keyPath: "id", indexes: [date, distance]
  "routes"   - keyPath: "id", indexes: [createdAt, city]
  "settings" - keyPath: "key" (single record, key="app")
```

## Patterns to Follow

### Pattern 1: State Machine for Run Lifecycle

**What:** Model the run session as an explicit state machine (`idle -> active -> paused -> completed`) rather than boolean flags.

**When:** Always, for the run session.

**Why:** Prevents impossible states (e.g., paused but no start time). Makes transitions explicit and testable. Every GPS tick handler can check `if (state !== 'active') return;` cleanly.

**Example:**
```typescript
function runReducer(state: RunSession, action: RunAction): RunSession {
  switch (action.type) {
    case 'START':
      if (state.state !== 'idle') return state;
      return { ...state, state: 'active', startedAt: Date.now() };
    case 'PAUSE':
      if (state.state !== 'active') return state;
      return { ...state, state: 'paused', pauseStartedAt: Date.now() };
    case 'RESUME':
      if (state.state !== 'paused') return state;
      const additionalPause = Date.now() - state.pauseStartedAt!;
      return { ...state, state: 'active', pausedDuration: state.pausedDuration + additionalPause };
    case 'END':
      if (state.state === 'idle') return state;
      return { ...state, state: 'completed' };
    case 'GPS_TICK':
      if (state.state !== 'active') return state;
      return { ...state, gpsTrace: [...state.gpsTrace, action.position] };
  }
}
```

### Pattern 2: GPS Filtering Pipeline

**What:** Filter raw GPS positions before using them for metrics. Discard positions with accuracy > 30m, ignore ticks where the runner moved < 2m (GPS jitter), cap speed at 45 km/h (teleport detection).

**When:** Every GPS tick, before appending to trace.

**Why:** Raw GPS data is noisy. Without filtering, a stationary runner accumulates phantom distance from GPS drift. iOS Safari GPS is particularly noisy in urban canyons.

**Example:**
```typescript
function shouldAcceptPosition(
  newPos: GeoPosition,
  lastPos: GeoPosition | null
): boolean {
  if (newPos.accuracy > 30) return false;
  if (!lastPos) return true;

  const distance = haversine(lastPos, newPos);
  const timeDelta = (newPos.timestamp - lastPos.timestamp) / 1000;
  const speed = distance / timeDelta; // m/s

  if (distance < 2) return false;      // GPS jitter
  if (speed > 12.5) return false;       // > 45 km/h = teleport
  return true;
}
```

### Pattern 3: Rolling Window Pace Calculation

**What:** Compute current pace from the last N seconds of GPS data rather than instantaneous speed.

**When:** Displaying "current pace" to the runner.

**Why:** Instantaneous GPS speed is extremely noisy. A 30-second rolling window produces the smooth, glanceable pace display runners expect from Runkeeper/Strava.

**Example:**
```typescript
function computeCurrentPace(trace: GeoPosition[], windowMs: number = 30000): number {
  const now = trace[trace.length - 1].timestamp;
  const cutoff = now - windowMs;
  const windowPoints = trace.filter(p => p.timestamp >= cutoff);

  if (windowPoints.length < 2) return 0;

  let distance = 0;
  for (let i = 1; i < windowPoints.length; i++) {
    distance += haversine(windowPoints[i - 1], windowPoints[i]);
  }

  const elapsed = (windowPoints[windowPoints.length - 1].timestamp - windowPoints[0].timestamp) / 1000;
  if (distance < 1) return 0;

  return (elapsed / distance) * 1000; // seconds per km
}
```

### Pattern 4: Imperative Map Control via Ref

**What:** Wrap MapLibre map instance in a controller class exposed via React context/ref. Views call imperative methods (`fitToRoute`, `rotateToBearing`) rather than passing map state as props.

**When:** Any map interaction beyond initial render.

**Why:** MapLibre is imperative by nature. Trying to reconcile its state with React's declarative model (via useEffect cleanup/re-add) creates flicker, race conditions, and performance issues. The current codebase already shows this pattern emerging (removing/re-adding layers on route change).

### Pattern 5: Crash Recovery via Periodic Snapshots

**What:** Every 30 seconds during an active run, write the current GPS trace and metrics to IndexedDB. On app launch, check for incomplete runs and offer to resume.

**When:** During active runs only.

**Why:** iOS Safari can kill PWA tabs. Runners lose their entire trace if the app crashes mid-run. This is unacceptable for a running app.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Computing Metrics in Render

**What:** Calculating pace, distance, or elapsed time inside React component render functions or inline JSX.

**Why bad:** GPS ticks at 1Hz means re-renders every second. If metric computation triggers additional state updates, you get cascading re-renders. The `totalCovered` calculation in the current `NavigationView` (measuring distance from start point rather than accumulating trace) is both inaccurate and computed during render.

**Instead:** Compute metrics in the state reducer or a dedicated callback. Store computed values in state. Components just read and display.

### Anti-Pattern 2: Storing GPS Traces in localStorage

**What:** Using `localStorage.setItem()` for run data that includes GPS coordinate arrays.

**Why bad:** localStorage is synchronous (blocks main thread), limited to ~5MB, and stores everything as strings. A 1-hour run at 1Hz GPS generates ~3,600 coordinate pairs (~150KB as JSON). After 30 runs, you hit the limit.

**Instead:** Use IndexedDB. It is asynchronous, has no practical size limit, supports structured data, and works from service workers.

### Anti-Pattern 3: Raw GPS Speed for Pace Display

**What:** Using `position.coords.speed` directly as the runner's pace.

**Why bad:** GPS speed is instantaneous and wildly inaccurate. It reports 0 when stationary, spikes when moving between GPS fix points, and varies by 30-50% second to second. Runners see "4:30... 7:00... 3:15" oscillating every second.

**Instead:** Rolling window pace over 20-30 seconds of accumulated GPS trace distance.

### Anti-Pattern 4: Re-creating Map Layers on Every State Change

**What:** Removing and re-adding MapLibre source/layer whenever route or visualization state changes.

**Why bad:** Causes visible flicker. Each remove/add cycle forces a GPU re-upload. The current `MapView` does this in `useEffect` on route change.

**Instead:** Add sources/layers once. Update data via `map.getSource('route').setData(newGeoJSON)`. Use `map.setPaintProperty()` for style changes.

## iOS Safari PWA-Specific Constraints

These constraints shape the architecture significantly:

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| **No background GPS** | GPS stops when screen is off or app is backgrounded | Wake Lock API (supported iOS 16.4+, fixed in PWA on iOS 18.4). Periodic audio keepalive as fallback. |
| **Tab can be killed** | iOS reclaims memory aggressively; long runs may lose state | Crash recovery via IndexedDB snapshots every 30s |
| **No Web Workers for GPS** | Cannot move geolocation.watchPosition to a worker | Keep GPS callback lightweight; offload heavy computation |
| **Service Worker limitations** | iOS limits SW lifetime, no background sync | Use SW only for app shell caching, not for GPS or run logic |
| **5MB localStorage limit** | Cannot store GPS traces | IndexedDB (no practical limit) |
| **No Web Bluetooth** | Cannot read heart rate monitors | Out of scope (Phase 2) |

## Scalability Considerations

| Concern | At 10 runs | At 100 runs | At 1000 runs |
|---------|-----------|-------------|-------------|
| **Storage** | ~1.5 MB in IndexedDB | ~15 MB in IndexedDB | ~150 MB; consider pruning GPS traces for old runs (keep summary only) |
| **History load** | Instant | Paginate (20 per page) | Paginate + IndexedDB cursor |
| **Map thumbnails** | Render on demand | Cache as blob in IndexedDB | Lazy load, virtualized list |
| **GPS trace display** | Full polyline | Full polyline | Simplify with Douglas-Peucker before display |

## Suggested Build Order (Dependencies)

The architecture has clear dependency chains that dictate build order:

```
Phase 1: Foundation (no dependencies)
  1a. IndexedDB storage layer (RunStorage, RouteStorage)
  1b. GPS filtering pipeline (gps-engine.ts)
  1c. Metrics calculator (pure functions, easily testable)
  1d. Wake Lock manager

Phase 2: Run Session (depends on Phase 1)
  2a. RunSession state machine + reducer
  2b. RunSessionProvider (React context, wires GPS -> metrics -> state)
  2c. Active run crash recovery (IndexedDB snapshots)

Phase 3: UI Integration (depends on Phase 2)
  3a. ActiveRunView (live metrics overlay)
  3b. Pause/Resume/End run controls
  3c. Navigation engine integration (current step, off-route)
  3d. Voice announcements for km milestones

Phase 4: Visualization (depends on Phase 2, parallel with Phase 3)
  4a. Map heading rotation during navigation
  4b. Route gradient visualization (progress along route)
  4c. GPS trace overlay (completed portion vs remaining)

Phase 5: Post-Run (depends on Phase 2 + 3)
  5a. RunSummaryView (stats display, GPS trace overlay)
  5b. Save/Discard flow
  5c. Enhanced HistoryView with run data

Phase 6: Polish (depends on all above)
  6a. Service worker for offline app shell
  6b. localStorage -> IndexedDB migration
  6c. Progress analytics (weekly summaries, pace trends)
```

**Dependency rationale:**
- IndexedDB and GPS filtering are leaf dependencies with no prerequisites -- build first.
- The RunSession state machine is the central integration point -- everything flows through it.
- UI and visualization can proceed in parallel once the session provider exists.
- Post-run features require the full run lifecycle to be working.
- Polish and analytics come last because they layer on top of working foundations.

## Sources

- [MDN: Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) - HIGH confidence
- [web.dev: Offline data (PWA)](https://web.dev/learn/pwa/offline-data) - HIGH confidence
- [MDN: Offline and background operation for PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) - HIGH confidence
- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/) - HIGH confidence
- [Can I Use: Wake Lock API](https://caniuse.com/wake-lock) - HIGH confidence
- [WebKit Bug 254545: Wake Lock in Home Screen Web Apps](https://bugs.webkit.org/show_bug.cgi?id=254545) - HIGH confidence (iOS PWA Wake Lock fix confirmed in iOS 18.4)
- [LogRocket: Offline-first frontend apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - MEDIUM confidence
- [Dartmouth MyRuns architecture](https://www.cs.dartmouth.edu/~campbell/cs65/myruns/myruns_manual.html) - MEDIUM confidence (MVC pattern for running apps)
- [Geoapify: Route visualization on MapLibre](https://dev.to/geoapify-maps-api/how-to-visualize-and-style-routes-on-a-maplibre-gl-map-416g) - MEDIUM confidence
