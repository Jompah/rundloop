# Phase 11: iOS Fixes & GPS Map Centering - Research

**Researched:** 2026-03-21
**Domain:** MapLibre GL JS map centering, Geolocation API, React state machines
**Confidence:** HIGH

## Summary

Phase 11 focuses on replacing the hardcoded Stockholm map center with GPS-based centering and implementing a centering state machine. IOS-01/02/03 are pre-completed (already committed). The remaining scope is MAP-01, MAP-02, MAP-03 -- all centered on the existing MapView.tsx component.

The codebase already has all the GPS plumbing (`watchFilteredPosition`, `getCurrentPosition`), map animation primitives (`flyTo`, `easeTo`), a user marker, and a recenter button pattern. The primary work is: (1) a `useMapCentering` hook implementing a state machine with `useReducer`, (2) persisting last-known position to IndexedDB for instant pre-GPS-lock display, (3) replacing the Stockholm hardcode with stored/GPS position, and (4) wiring a "center on me" button visible in non-navigation states.

**Primary recommendation:** Build a pure `useReducer`-based centering state machine (following the `useRunSession` pattern) in a new `useMapCentering` hook, persist last-known coords to IndexedDB `settings` store, and modify MapView.tsx to consume the hook's state for centering behavior.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- On app open, show something sensible before GPS lock (no Stockholm hardcode flash)
- When GPS locks, smooth flyTo() animation (~1.5s) to user position
- Default idle zoom level: 15 (~500m visible radius)
- Map stays north-up in idle mode; heading-up only during active navigation
- Center-on-me button should be visible on the map in non-navigation states

### Claude's Discretion
- Pre-GPS-lock UX approach (last known location vs loading overlay vs zoomed-out)
- Center-on-me button placement and visual design
- State machine implementation details (state names, transition triggers, timeouts)
- Loading indicator design during GPS acquisition
- Error/fallback behavior when GPS is denied or unavailable

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IOS-01 | Map renders correctly on iOS Safari (no black screen) | PRE-COMPLETED. ResizeObserver pattern in MapView.tsx already handles this. |
| IOS-02 | UI elements not overlapped by bottom tab bar | PRE-COMPLETED. Safe area CSS variables and `safe-bottom` classes already applied. |
| IOS-03 | Explicit GPS permission flow (retry/simulate) | PRE-COMPLETED. `gpsError` state with retry + simulate buttons in page.tsx. |
| MAP-01 | Map auto-centers on user GPS position on app open | Replace Stockholm hardcode `[18.0686, 59.3293]` with last-known position from IndexedDB; on GPS lock use `flyTo()` with ~1.5s duration to user position at zoom 15. |
| MAP-02 | "Center on me" button visible on map to re-center anytime | Existing `centerOnUser()` in MapView.tsx already implements this for non-navigation state. Needs state machine integration so it transitions from `free-pan` back to `centered`. |
| MAP-03 | Map centering state machine (auto-rotate during nav vs free-pan vs centered) | New `useMapCentering` hook with `useReducer`. States: `initializing` -> `centered` -> `free-pan` (on drag) -> `centered` (on button press). Navigation mode handled separately via existing `isAutoRotating` ref pattern. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | 5.20.2 | Map rendering, flyTo/easeTo animations | Already installed, all map code uses it |
| react | 19.2.4 | UI framework, useReducer for state machine | Already installed |
| next | 16.2.0 | App framework | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fake-indexeddb | 6.2.5 | Test IndexedDB operations | Already in devDependencies, used by existing tests |
| vitest | 4.1.0 | Test runner | Already configured, 125 tests passing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useReducer state machine | XState/Zustand | Overkill -- useReducer matches existing useRunSession pattern, zero new deps |
| IndexedDB for last position | localStorage | IndexedDB already used for everything; localStorage would be inconsistent |

**No new packages required.** All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/
│   └── useMapCentering.ts    # NEW: centering state machine hook
├── components/
│   └── MapView.tsx            # MODIFY: consume useMapCentering, remove hardcoded center
├── lib/
│   ├── geolocation.ts         # EXISTING: getCurrentPosition(), watchPosition()
│   ├── gps-filter.ts          # EXISTING: watchFilteredPosition()
│   └── db.ts                  # EXISTING: dbGet/dbPut for last-known position
└── app/
    └── page.tsx               # MODIFY: wire useMapCentering into MapView props
```

### Pattern 1: Centering State Machine (useReducer)
**What:** A `useReducer`-based hook managing map centering states with pure transitions
**When to use:** Always -- this is the core deliverable of MAP-03
**States:**

```typescript
type CenteringMode = 'initializing' | 'centered' | 'free-pan' | 'navigating';

type CenteringAction =
  | { type: 'GPS_LOCK'; position: [number, number] }
  | { type: 'USER_PAN' }
  | { type: 'RECENTER' }
  | { type: 'START_NAVIGATION' }
  | { type: 'STOP_NAVIGATION' }
  | { type: 'GPS_UPDATE'; position: [number, number] };

interface CenteringState {
  mode: CenteringMode;
  userPosition: [number, number] | null;
  lastStoredPosition: [number, number] | null;
}
```

**Transitions:**
```
initializing --[GPS_LOCK]--> centered
centered     --[USER_PAN]--> free-pan
free-pan     --[RECENTER]--> centered
centered     --[START_NAVIGATION]--> navigating
free-pan     --[START_NAVIGATION]--> navigating
navigating   --[STOP_NAVIGATION]--> centered
navigating   --[USER_PAN]--> free-pan (with showRecenter=true)
```

**Example:**
```typescript
// Following useRunSession pattern from src/hooks/useRunSession.ts
export function centeringReducer(state: CenteringState, action: CenteringAction): CenteringState {
  switch (action.type) {
    case 'GPS_LOCK':
      return { ...state, mode: 'centered', userPosition: action.position };
    case 'USER_PAN':
      if (state.mode === 'initializing') return state;
      return { ...state, mode: 'free-pan' };
    case 'RECENTER':
      return { ...state, mode: 'centered' };
    case 'START_NAVIGATION':
      return { ...state, mode: 'navigating' };
    case 'STOP_NAVIGATION':
      return { ...state, mode: 'centered' };
    case 'GPS_UPDATE':
      return { ...state, userPosition: action.position };
    default:
      return state;
  }
}
```

### Pattern 2: Last-Known Position Persistence
**What:** Save GPS coords to IndexedDB `settings` store on each accepted position update; read on app startup
**When to use:** MAP-01 pre-GPS-lock display

```typescript
// Store format: { key: 'lastPosition', lng: number, lat: number, timestamp: number }
// Read on mount: const stored = await dbGet('settings', 'lastPosition');
// Write on GPS update: await dbPut('settings', { key: 'lastPosition', lng, lat, timestamp: Date.now() });
```

Uses existing `settings` object store in IndexedDB (already created in db.ts). No schema migration needed since `settings` store uses `keyPath: 'key'` -- any key works.

### Pattern 3: Map Initialization Without Hardcode
**What:** Replace `center: [18.0686, 59.3293]` with last-known position or world view
**When to use:** MapView initialization

```typescript
// On map init:
const initialCenter = lastStoredPosition || [0, 0]; // World center fallback
const initialZoom = lastStoredPosition ? 13 : 2;    // Zoomed if position known, world view otherwise

const map = new maplibregl.Map({
  container: mapContainer.current,
  style: DARK_STYLE,
  center: initialCenter,
  zoom: initialZoom,
  attributionControl: false,
});
```

### Anti-Patterns to Avoid
- **Hardcoded coordinates as default center:** The current `[18.0686, 59.3293]` Stockholm center causes a flash for non-Stockholm users. Always use stored or zero-center.
- **Multiple GPS watchers:** page.tsx already runs `watchFilteredPosition`. Do NOT start a second watcher in the centering hook -- consume the position from the existing watcher via props/state.
- **Calling flyTo during every GPS update:** Only `flyTo` on initial GPS lock. Subsequent updates in `centered` mode should use `easeTo` with short duration (~300ms) or `setCenter` for snappy following.
- **Forgetting to detach dragstart listener:** Map drag events must cleanly unsubscribe on component unmount.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map animation | Custom requestAnimationFrame loop | MapLibre `flyTo()` / `easeTo()` | Built-in easing, handles interrupts, GPU-accelerated |
| GPS position watching | Raw navigator.geolocation | Existing `watchFilteredPosition()` | Already handles accuracy/jitter/teleport filtering |
| State persistence | Custom localStorage wrapper | Existing `dbGet`/`dbPut` with IndexedDB | Consistent with rest of app, already handles persistence |
| Coordinate math | Manual lng/lat computations | Existing `haversineMeters()` in gps-filter.ts | Already implemented and tested |

**Key insight:** The codebase has mature GPS, map animation, and persistence infrastructure. This phase is primarily about orchestration (state machine) and wiring, not building new primitives.

## Common Pitfalls

### Pitfall 1: flyTo During Every GPS Update
**What goes wrong:** Map jerks constantly as flyTo queues conflict with each other
**Why it happens:** Treating GPS_UPDATE the same as GPS_LOCK
**How to avoid:** `flyTo` only on initial GPS lock (transition from `initializing` to `centered`). In `centered` mode, use `easeTo` with short duration or `jumpTo` for smooth tracking.
**Warning signs:** Map "vibrating" during GPS tracking

### Pitfall 2: Conflicting Map Controls Between Modes
**What goes wrong:** Centering state machine fights with NavigationView's existing auto-rotation
**Why it happens:** Both systems try to call `easeTo`/`flyTo` on the same map instance
**How to avoid:** When `mode === 'navigating'`, the centering hook yields all map control to the existing navigation code in MapView.tsx. The hook only tracks position, never animates.
**Warning signs:** Map snapping between two viewpoints rapidly

### Pitfall 3: IndexedDB Read Blocking Map Init
**What goes wrong:** Map shows at [0,0] briefly while IndexedDB read completes
**Why it happens:** IndexedDB operations are async; map constructor is synchronous
**How to avoid:** Read last-known position BEFORE rendering MapView. In page.tsx, add a loading state that reads from IndexedDB before mounting the map.
**Warning signs:** Brief flash of world map before centering

### Pitfall 4: Stale Stored Position
**What goes wrong:** Map centers on a months-old position from a different city
**Why it happens:** No expiry on stored position
**How to avoid:** Include timestamp with stored position. If older than 24 hours, treat as "no stored position" and use the zoomed-out world view instead.
**Warning signs:** Map centers on previous city before GPS lock

### Pitfall 5: Double GPS Watcher
**What goes wrong:** Battery drain, conflicting position updates
**Why it happens:** Creating a new watcher in useMapCentering while page.tsx already runs one
**How to avoid:** The centering hook should NOT create its own GPS watcher. It receives position updates via props from page.tsx's existing watcher.
**Warning signs:** Two GPS indicators in browser, excessive battery usage

### Pitfall 6: iOS Safari flyTo Not Firing
**What goes wrong:** flyTo animation doesn't trigger on iOS Safari
**Why it happens:** Map container may not be fully laid out when flyTo is called (ResizeObserver hasn't fired yet)
**How to avoid:** Only call flyTo after `mapLoaded` is true (the existing `map.on('load')` callback). The state machine's GPS_LOCK action should be gated on map readiness.
**Warning signs:** Map stays at initial position despite GPS lock

## Code Examples

### Map Initialization with Last-Known Position
```typescript
// In page.tsx, before MapView renders:
const [initialPosition, setInitialPosition] = useState<[number, number] | null>(null);
const [positionLoaded, setPositionLoaded] = useState(false);

useEffect(() => {
  dbGet<{ key: string; lng: number; lat: number; timestamp: number }>('settings', 'lastPosition')
    .then((stored) => {
      if (stored && (Date.now() - stored.timestamp < 24 * 60 * 60 * 1000)) {
        setInitialPosition([stored.lng, stored.lat]);
      }
      setPositionLoaded(true);
    })
    .catch(() => setPositionLoaded(true));
}, []);
```

### Persisting Position on GPS Update
```typescript
// In the existing GPS watcher callback in page.tsx:
watchFilteredPosition(
  (pos) => {
    setUserLocation([pos.lng, pos.lat]);
    setUserHeading(pos.heading);
    setUserSpeed(pos.speed);
    // Persist for next app launch (debounced or on significant change)
    dbPut('settings', { key: 'lastPosition', lng: pos.lng, lat: pos.lat, timestamp: Date.now() });
  },
  ...
);
```

### flyTo on GPS Lock
```typescript
// MapLibre flyTo API (verified: maplibre-gl 5.20.2)
map.flyTo({
  center: [lng, lat],
  zoom: 15,
  duration: 1500,   // ~1.5s as specified by user
  essential: true,   // Not affected by prefers-reduced-motion
});
```

### easeTo for Continuous Following
```typescript
// In centered mode, follow GPS updates smoothly
map.easeTo({
  center: [lng, lat],
  zoom: 15,
  bearing: 0,       // North-up in idle mode
  pitch: 0,
  duration: 300,
});
```

### Drag Detection for Free-Pan Transition
```typescript
// Already exists in MapView.tsx -- extend for non-navigation states:
map.on('dragstart', () => {
  dispatch({ type: 'USER_PAN' });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded Stockholm center | GPS-based centering with stored fallback | This phase | Fixes UX for non-Stockholm users |
| No centering state management | useReducer state machine | This phase | Clean state transitions, testable |
| centerOnUser as simple flyTo | State-aware centering with mode transitions | This phase | Consistent behavior across app states |

**Existing code that needs modification:**
- `MapView.tsx` line 44: `center: [18.0686, 59.3293]` -- replace with prop
- `MapView.tsx` line 45: `zoom: 13` -- adjust to 15 or use stored zoom
- `MapView.tsx` lines 74-91: drag detection -- extend to non-navigation states
- `MapView.tsx` lines 237-248: centerOnUser button -- wire to state machine
- `page.tsx` lines 124-156: GPS init -- add position persistence

## Open Questions

1. **Debounce frequency for position persistence**
   - What we know: IndexedDB writes are fast (~1ms) but GPS updates every ~1s
   - What's unclear: Whether writing every update causes any iOS performance issues
   - Recommendation: Write on every accepted position (filtered by gps-filter already reduces frequency). If performance issues arise, add a 5-second debounce.

2. **World view vs loading overlay for first-ever launch**
   - What we know: User said "something sensible before GPS lock"
   - What's unclear: Whether a zoomed-out world map or a loading spinner is more "sensible"
   - Recommendation: Show map at zoom 2 centered on [0,0] with a subtle "Locating..." indicator overlay. This avoids a blank screen and immediately shows the map is functional. The flyTo animation from world view to user position looks polished.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IOS-01 | Map renders on iOS Safari | manual-only | N/A (requires iOS device) | N/A -- pre-completed |
| IOS-02 | UI not overlapped by tab bar | manual-only | N/A (requires iOS device) | N/A -- pre-completed |
| IOS-03 | GPS permission retry flow | manual-only | N/A (requires GPS permission UI) | N/A -- pre-completed |
| MAP-01 | Map auto-centers on GPS position | unit | `npx vitest run src/hooks/__tests__/useMapCentering.test.ts -t "GPS_LOCK"` | No -- Wave 0 |
| MAP-02 | Center-on-me button recenters | unit | `npx vitest run src/hooks/__tests__/useMapCentering.test.ts -t "RECENTER"` | No -- Wave 0 |
| MAP-03 | State machine transitions | unit | `npx vitest run src/hooks/__tests__/useMapCentering.test.ts -t "transitions"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useMapCentering.test.ts` -- covers MAP-01, MAP-02, MAP-03 (tests pure reducer logic: state transitions, GPS_LOCK, USER_PAN, RECENTER, START/STOP_NAVIGATION)

## Sources

### Primary (HIGH confidence)
- Codebase inspection: MapView.tsx, page.tsx, geolocation.ts, gps-filter.ts, useRunSession.ts, db.ts, storage.ts -- all read directly
- maplibre-gl 5.20.2 installed -- flyTo/easeTo API verified from package
- vitest 4.1.0 -- test suite verified (125 passing, 0 failing)

### Secondary (MEDIUM confidence)
- MapLibre GL JS flyTo options (`essential`, `duration`, `zoom`) -- consistent across major versions, stable API

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, versions verified from package.json and node_modules
- Architecture: HIGH -- state machine pattern directly follows existing useRunSession.ts codebase pattern
- Pitfalls: HIGH -- derived from reading actual codebase code and understanding existing GPS/map interaction flow

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain, no fast-moving dependencies)
