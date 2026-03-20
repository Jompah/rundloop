# Phase 3: Live Run Metrics - Research

**Researched:** 2026-03-20
**Domain:** Real-time GPS metrics calculation and glanceable UI overlay
**Confidence:** HIGH

## Summary

Phase 3 builds a live metrics overlay on top of the existing `useRunSession` hook and `NavigationView` component. The data sources already exist: `elapsedMs`, `distanceMeters`, `trace` (GPS history), and `route.distance` (total planned distance). The main new logic is rolling pace calculation from the GPS trace, unit conversion (km/miles), and remaining distance computation. The UI work is a 2x2 grid overlay with high-contrast large fonts on the bottom half of the map.

No new libraries are needed. All computation is pure math on existing data structures. The primary risk is pace calculation stability -- raw GPS speed is volatile and explicitly out of scope (see REQUIREMENTS.md "Out of Scope: Instantaneous GPS pace display"). The 30-second rolling window approach specified in CONTEXT.md is the correct solution.

**Primary recommendation:** Extract metrics calculation into a pure `computeRunMetrics()` function that takes trace, elapsedMs, and route distance as inputs and returns all display values. This keeps logic testable and the UI component thin.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Metrics arranged in a 2x2 grid (pace, distance, time, remaining)
- Panel lives as a semi-transparent overlay on the bottom half of the map -- runner still sees the route
- Pace is the hero metric (largest), other three metrics equal size below
- Fixed layout -- no customization in this phase
- Rolling pace uses a 30-second window -- balances responsiveness and stability
- Pace displayed as "5:30 /km" (min:sec per km) -- standard running format
- Both current rolling pace and average pace shown -- runners want current effort vs overall
- On pause: freeze last pace value, dim slightly to signal paused state
- Distance shown with 1 decimal precision (e.g., "3.2 km")
- Remaining distance = route total distance minus distance covered
- Time format: "MM:SS" under 1 hour, "H:MM:SS" over 1 hour (matches existing NavigationView format)
- All distance and pace display respects the existing `settings.units` preference (km/miles)

### Claude's Discretion
- Exact color palette and font sizes for the metrics overlay (must be high contrast, dark theme)
- Animation/transition details for metrics updates
- Exact positioning and spacing within the 2x2 grid

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| METR-01 | Current pace displayed as rolling lap pace (per-km average, not instantaneous GPS) | Rolling 30s window over GPS trace with haversine distance; pure function `computeRollingPace()` |
| METR-02 | Total distance covered displayed in real-time | Already provided by `useRunSession.distanceMeters`; format with unit conversion |
| METR-03 | Elapsed time displayed (paused time excluded) | Already provided by `useRunSession.elapsedMs`; reuse `formatElapsed()` pattern |
| METR-04 | Remaining distance to finish displayed | `route.distance - distanceMeters`; requires route prop passed to metrics overlay |
| METR-05 | Stats panel uses large fonts and high contrast, readable at a glance while running | Tailwind 4 utility classes; 2x2 grid overlay with `text-4xl`+ hero metric |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI framework | Already in project |
| Next.js | 16.2.0 | App framework | Already in project |
| Tailwind CSS | 4.x | Styling | Already in project, used for all existing UI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.x | Unit testing | Test pure metric calculation functions |
| fake-indexeddb | 6.2.5 | Test DB mocking | Already in project devDependencies |

### Alternatives Considered
None -- this phase requires no new dependencies. All computation is pure JS math on existing data structures.

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    metrics.ts           # Pure functions: computeRollingPace, computeAveragePace, formatPace, metersToUnit
    __tests__/
      metrics.test.ts    # Unit tests for all metric calculations
  components/
    RunMetricsOverlay.tsx # 2x2 grid overlay component
    NavigationView.tsx    # Modified to include RunMetricsOverlay
```

### Pattern 1: Pure Metrics Computation
**What:** Extract all metric calculation into pure functions in `src/lib/metrics.ts`
**When to use:** Always -- keeps logic testable without React rendering
**Example:**
```typescript
// src/lib/metrics.ts
import { FilteredPosition } from '@/types';

/**
 * Compute rolling pace from GPS trace using a time window.
 * Returns pace in seconds per kilometer (or per mile).
 * Returns null if insufficient data.
 */
export function computeRollingPace(
  trace: FilteredPosition[],
  windowMs: number = 30_000
): number | null {
  if (trace.length < 2) return null;

  const now = trace[trace.length - 1].timestamp;
  const windowStart = now - windowMs;

  // Find first point within the window
  let startIdx = trace.length - 1;
  for (let i = trace.length - 2; i >= 0; i--) {
    if (trace[i].timestamp < windowStart) break;
    startIdx = i;
  }

  if (startIdx === trace.length - 1) return null;

  // Sum haversine distances within window
  let distMeters = 0;
  for (let i = startIdx + 1; i < trace.length; i++) {
    distMeters += haversineMeters(
      trace[i - 1].lat, trace[i - 1].lng,
      trace[i].lat, trace[i].lng
    );
  }

  if (distMeters < 1) return null; // Avoid division by zero

  const elapsedSec = (trace[trace.length - 1].timestamp - trace[startIdx].timestamp) / 1000;
  // Pace = seconds per km
  return (elapsedSec / distMeters) * 1000;
}

/**
 * Compute average pace for the entire run.
 * Returns pace in seconds per kilometer.
 */
export function computeAveragePace(
  distanceMeters: number,
  elapsedMs: number
): number | null {
  if (distanceMeters < 10 || elapsedMs < 1000) return null;
  return (elapsedMs / 1000 / distanceMeters) * 1000;
}

/**
 * Format pace as "M:SS" string.
 * paceSecsPerKm: seconds per kilometer
 */
export function formatPace(paceSecsPerKm: number | null, units: 'km' | 'miles'): string {
  if (paceSecsPerKm === null) return '--:--';
  // Convert to per-mile if needed
  const pace = units === 'miles' ? paceSecsPerKm * 1.60934 : paceSecsPerKm;
  const minutes = Math.floor(pace / 60);
  const seconds = Math.floor(pace % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format distance with 1 decimal precision.
 */
export function formatMetricDistance(meters: number, units: 'km' | 'miles'): string {
  const value = units === 'miles' ? meters / 1609.34 : meters / 1000;
  return value.toFixed(1);
}
```

### Pattern 2: Overlay Component with Ref-Based Data
**What:** The metrics overlay reads from `useRunSession` return values. Since the hook already uses `useRef` + periodic `setState` for timer and distance, the overlay re-renders at the same ~100ms cadence as the timer.
**When to use:** For the RunMetricsOverlay component
**Key insight:** Rolling pace should also be computed on each render (driven by the 100ms timer interval), not on a separate interval. This avoids multiple competing update loops.

### Pattern 3: Existing formatElapsed Reuse
**What:** `NavigationView` already has `formatElapsed()` that handles `MM:SS` and `H:MM:SS` formats. Extract to shared location or duplicate in metrics.ts.
**When to use:** For METR-03 elapsed time display

### Anti-Patterns to Avoid
- **Separate setInterval for pace:** Do not create a new interval for pace updates. The existing 100ms timer interval in useRunSession already triggers re-renders. Compute pace on render.
- **Storing pace in state/ref:** Pace is derived data. Compute it from the trace on each render. No need for additional state.
- **Direct GPS speed usage:** The `FilteredPosition.speed` field from the Geolocation API is too volatile. The REQUIREMENTS explicitly ban instantaneous GPS pace display. Always use the rolling window calculation.
- **Mutating trace array during computation:** The `traceRef.current` array is appended to by the GPS watcher. Read it for computation but never mutate it from the metrics component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance between GPS coords | Custom distance formula | Existing `haversineMeters()` from storage.ts | Already proven, used in 3 places |
| Time formatting | Custom date formatting | Existing `formatElapsed()` pattern from NavigationView | Already handles H:MM:SS edge case |
| Unit conversion | Inline multiplication | Centralized `formatMetricDistance()` and pace unit conversion | Settings preference must be consistent |

**Key insight:** The codebase already has haversine in 3 places (storage.ts, gps-filter.ts, useRunSession.ts). For metrics.ts, import from storage.ts which is the canonical exported version.

## Common Pitfalls

### Pitfall 1: Pace Flickering on Sparse GPS Data
**What goes wrong:** With GPS filtering rejecting jitter (<3m) and low accuracy (>30m), the trace can have gaps. A 30-second window might have very few points early in a run.
**Why it happens:** GPS filter rejects most readings in first 10-20 seconds; urban environments can have poor accuracy.
**How to avoid:** Return `null` (display "--:--") when the rolling window has fewer than 2 points or less than 10m of distance. Show average pace as fallback until rolling pace stabilizes.
**Warning signs:** Pace jumping from "--:--" to extreme values in first minute.

### Pitfall 2: Division by Zero in Pace Calculation
**What goes wrong:** If distance in window is 0 (runner standing still), pace becomes infinity.
**Why it happens:** GPS jitter filter means 0 distance is common when stationary.
**How to avoid:** Guard with minimum distance threshold (e.g., 1m). Return null for display as "--:--".
**Warning signs:** "Infinity" or "NaN" displayed in pace field.

### Pitfall 3: Remaining Distance Goes Negative
**What goes wrong:** `route.distance - distanceMeters` can go negative if the runner overshoots the route or GPS drift accumulates extra distance.
**Why it happens:** GPS trace distance is cumulative and includes GPS noise. Route distance is planned OSRM distance.
**How to avoid:** Clamp remaining distance to `Math.max(0, route.distance - distanceMeters)`. Display "0.0 km" when complete.
**Warning signs:** Negative numbers in remaining distance display.

### Pitfall 4: Pause State Confusion
**What goes wrong:** Metrics continue updating during pause, or frozen values not visually distinguishable.
**Why it happens:** The timer effect stops on pause (status !== 'active'), but a stale render might still trigger.
**How to avoid:** When `runStatus === 'paused'`, freeze all displayed values and apply visual dimming (opacity-60 or similar). The hook already freezes `elapsedMs` on pause via `dispatch({ type: 'PAUSE', elapsedMs })`.
**Warning signs:** Timer incrementing during pause; pace changing while paused.

### Pitfall 5: Unit Conversion Inconsistency
**What goes wrong:** Distance in km but pace in min/mile, or vice versa.
**Why it happens:** Forgetting to pass `settings.units` to all formatting functions.
**How to avoid:** Single `units` prop passed to the overlay component. All formatting functions take `units` parameter. Unit label ("km" vs "mi") displayed alongside values.
**Warning signs:** "5:30 /km" next to "3.2 mi" (mixing units).

## Code Examples

### Rolling Pace Calculation (Core Algorithm)
```typescript
// The key insight: walk backwards through the trace to find points within the window
// This is O(n) in the worst case but typically only scans ~30 seconds of data
function computeRollingPace(
  trace: FilteredPosition[],
  windowMs: number = 30_000
): number | null {
  if (trace.length < 2) return null;

  const latestTimestamp = trace[trace.length - 1].timestamp;
  const cutoff = latestTimestamp - windowMs;

  let windowStartIdx = trace.length - 1;
  for (let i = trace.length - 2; i >= 0; i--) {
    if (trace[i].timestamp < cutoff) break;
    windowStartIdx = i;
  }

  if (windowStartIdx >= trace.length - 1) return null;

  let dist = 0;
  for (let i = windowStartIdx + 1; i < trace.length; i++) {
    dist += haversineMeters(
      trace[i-1].lat, trace[i-1].lng,
      trace[i].lat, trace[i].lng
    );
  }

  if (dist < 1) return null;

  const timeSec = (latestTimestamp - trace[windowStartIdx].timestamp) / 1000;
  return (timeSec / dist) * 1000; // seconds per km
}
```

### Metrics Overlay Component Structure
```typescript
// RunMetricsOverlay.tsx - conceptual structure
interface RunMetricsOverlayProps {
  trace: FilteredPosition[];
  elapsedMs: number;
  distanceMeters: number;
  routeDistanceMeters: number;
  runStatus: 'active' | 'paused';
  units: 'km' | 'miles';
}

// 2x2 grid: hero pace on top spanning full width or left,
// average pace right, distance bottom-left, time+remaining bottom-right
// Semi-transparent bg-gray-900/90 backdrop-blur
// Large fonts: hero text-5xl, secondary text-3xl
// On pause: opacity-60 applied to entire overlay
```

### Integration Point in NavigationView
```typescript
// NavigationView bottom bar currently shows elapsed + distance inline.
// Replace bottom bar content with RunMetricsOverlay component.
// The overlay receives all data as props from NavigationView.
// NavigationView already receives: elapsedMs, distanceMeters, runStatus
// Additionally needs: trace (from useRunSession), route.distance, units (from settings)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Instantaneous GPS speed | Rolling window pace | Industry standard (Strava, Nike Run Club) | Stable, meaningful pace display |
| Small font metrics | Large, high-contrast fonts | Mobile running app standard | Readable at arm's length while running |
| Full-screen metrics | Semi-transparent overlay on map | Modern running apps (2020+) | Runner maintains spatial awareness |

**Deprecated/outdated:**
- `FilteredPosition.speed` (from Geolocation API): Too volatile for pace display. Explicitly out of scope per REQUIREMENTS.md.

## Open Questions

1. **Trace access from NavigationView**
   - What we know: `useRunSession` returns `trace: traceRef.current` (a ref, not a copy). NavigationView does not currently receive trace.
   - What's unclear: Whether passing trace from page.tsx -> NavigationView -> RunMetricsOverlay causes render issues since it's a ref.
   - Recommendation: Pass `runSession.trace` as prop. Since trace is a ref value (not state), it won't trigger re-renders on its own -- the 100ms timer setState drives renders, and trace is read fresh each render. This is the established pattern in the codebase.

2. **Settings async access**
   - What we know: `getSettings()` in storage.ts is now `async` (returns Promise). NavigationView currently calls `getSettings()` synchronously at render time (line 73).
   - What's unclear: This might be using an older sync version or a cached value. Need to verify at implementation time.
   - Recommendation: Load settings once when NavigationView mounts and store in state. Units don't change mid-run.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/lib/__tests__/metrics.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| METR-01 | Rolling pace from 30s GPS trace window | unit | `npx vitest run src/lib/__tests__/metrics.test.ts -t "rolling pace"` | Wave 0 |
| METR-02 | Distance formatting with unit conversion | unit | `npx vitest run src/lib/__tests__/metrics.test.ts -t "distance"` | Wave 0 |
| METR-03 | Elapsed time formatting (MM:SS and H:MM:SS) | unit | `npx vitest run src/lib/__tests__/metrics.test.ts -t "elapsed"` | Wave 0 |
| METR-04 | Remaining distance clamped to >= 0 | unit | `npx vitest run src/lib/__tests__/metrics.test.ts -t "remaining"` | Wave 0 |
| METR-05 | Glanceable UI (large fonts, high contrast) | manual-only | Visual inspection on mobile viewport | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/__tests__/metrics.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/metrics.test.ts` -- covers METR-01 through METR-04 pure functions
- [ ] `src/lib/metrics.ts` -- new module, must be created before tests

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/hooks/useRunSession.ts` -- data flow, trace structure, timer pattern
- Codebase analysis: `src/components/NavigationView.tsx` -- existing UI layout, formatElapsed/formatDistance patterns
- Codebase analysis: `src/lib/gps-filter.ts` -- GPS filtering rules affecting trace quality
- Codebase analysis: `src/types/index.ts` -- FilteredPosition, GeneratedRoute, AppSettings types
- Codebase analysis: `src/lib/storage.ts` -- haversineMeters canonical export, getSettings async API, units preference

### Secondary (MEDIUM confidence)
- Rolling pace 30-second window: Standard approach in running apps (Strava, Nike Run Club, Garmin). Validated by CONTEXT.md user decision.

### Tertiary (LOW confidence)
- None -- all findings verified against codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, pure computation on existing data
- Architecture: HIGH -- follows established codebase patterns (pure functions in lib/, components receive props)
- Pitfalls: HIGH -- derived from analysis of actual GPS filter behavior and data types in codebase

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no external dependencies or fast-moving APIs)
