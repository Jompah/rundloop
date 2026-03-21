# Phase 5: Run Summary - Research

**Researched:** 2026-03-20
**Domain:** Post-run summary UI, calorie estimation, IndexedDB save/discard flow
**Confidence:** HIGH

## Summary

Phase 5 adds a post-run summary/reward screen shown after endRun completes. The implementation is primarily a UI component (RunSummaryView) that consumes the existing `CompletedRun` data, plus a small settings extension for body weight and a calorie estimation utility. All core infrastructure already exists: `CompletedRun` type has distance/time/trace, `metrics.ts` has formatters, `db.ts` has CRUD operations, and `MapView` can render polylines.

The main integration challenge is the flow change in `page.tsx`: after EndRunDialog confirm, instead of returning to map, the app must capture the `CompletedRun` returned by `endRun()` and show RunSummaryView. The summary view needs both the CompletedRun data and the original route (for overlay comparison). The discard flow deletes from IndexedDB with confirmation.

**Primary recommendation:** Build RunSummaryView as a self-contained component receiving CompletedRun + GeneratedRoute props, add bodyWeightKg to AppSettings, create a simple calorie utility, and rewire the EndRunDialog confirm handler in page.tsx.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Display 4 key stats: total distance, elapsed time, average pace, estimated calories burned
- Map shows GPS trace overlaid on planned route -- runner sees how well they followed
- Layout: map on top half, stats card below, save/discard buttons at bottom
- Subtle fade-in animation for achievement feel -- not over the top
- "Save" keeps run in IndexedDB history (endRun already persists it; save = keep)
- "Discard" deletes from IndexedDB with "Are you sure?" confirmation dialog
- After save or discard, return to map view (route generator) -- clean slate
- Summary is a one-time view after each run; saved runs accessible later via history (Phase 6)
- Simple running calorie formula: `distance_km * body_weight_kg * 1.036`
- Body weight configurable in Settings screen as optional numeric input (kg)
- Default 70kg if not set -- show calories with small note "Update weight in Settings for accuracy"
- Weight display follows existing units setting: kg for metric, lbs for imperial (auto-convert)

### Claude's Discretion
- Exact stats card visual design (colors, spacing, typography within dark theme)
- Map zoom/bounds behavior for the summary view
- Fade-in animation timing and easing
- Discard confirmation dialog styling

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUMM-01 | After completing or ending a run, summary screen shows total distance, time, and average pace | CompletedRun has distanceMeters, elapsedMs; metrics.ts has computeAveragePace, formatPace, formatMetricDistance, formatElapsed |
| SUMM-02 | Summary shows map with actual GPS trace overlaid on planned route | CompletedRun.trace provides GPS points; route.polyline provides planned route; MapView already renders GeoJSON polylines |
| SUMM-03 | User can save or discard the completed run | endRun() already saves to IndexedDB; discard = dbDelete('runs', id); DiscardConfirmDialog follows EndRunDialog pattern |
| SUMM-04 | Estimated calories burned displayed (based on distance and configurable body weight) | New calorie utility + bodyWeightKg field on AppSettings + Settings UI weight input |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.4 | Component rendering | Already in project |
| maplibre-gl | 5.20.2 | Map rendering with polyline overlay | Already in project, used by MapView |
| tailwindcss | 4.x | Styling (dark theme) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.0 | Unit testing calorie/formatter logic | Test new utility functions |

### Alternatives Considered
No new dependencies needed. All functionality builds on existing stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    RunSummaryView.tsx      # NEW: Full-screen summary view
    DiscardConfirmDialog.tsx # NEW: "Are you sure?" dialog for discard
  lib/
    calories.ts             # NEW: Calorie estimation utility
    metrics.ts              # EXISTING: Add formatCalories if needed
  lib/__tests__/
    calories.test.ts        # NEW: Unit tests for calorie logic
  types/
    index.ts                # MODIFY: Add bodyWeightKg to AppSettings
  app/
    page.tsx                # MODIFY: Add summary view state + flow
  components/
    SettingsView.tsx         # MODIFY: Add body weight input
```

### Pattern 1: View Switching via State in page.tsx
**What:** The app uses a state variable (`view`) in page.tsx to toggle between screens. Summary is a new view state.
**When to use:** For the summary screen lifecycle.
**Example:**
```typescript
// In types/index.ts - extend AppView
export type AppView = 'map' | 'generate' | 'navigate' | 'settings' | 'history' | 'summary';

// In page.tsx - new state for completed run data
const [completedRunData, setCompletedRunData] = useState<CompletedRun | null>(null);

// EndRunDialog confirm handler - capture CompletedRun before showing summary
onConfirm={async () => {
  const completed = await runSession.endRun();
  setCompletedRunData(completed);
  setShowEndRunDialog(false);
  setView('summary');
}}
```

### Pattern 2: Two-Polyline Map Overlay
**What:** Summary map shows both the planned route and actual GPS trace as separate GeoJSON layers.
**When to use:** SUMM-02 requirement.
**Example:**
```typescript
// Planned route: green line (existing pattern from MapView)
map.addSource('planned-route', {
  type: 'geojson',
  data: {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: route.polyline, // [lng, lat][]
    },
  },
});

// Actual trace: blue/cyan line on top
map.addSource('actual-trace', {
  type: 'geojson',
  data: {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: completedRun.trace.map(p => [p.lng, p.lat]),
    },
  },
});
```

### Pattern 3: Dialog Pattern (from EndRunDialog)
**What:** Modal dialog with dark overlay, rounded container, two-button layout.
**When to use:** Discard confirmation dialog.
**Example:**
```typescript
// Follows exact pattern from EndRunDialog.tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
  <div className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full">
    <h2 className="text-white text-xl font-bold">Discard Run?</h2>
    <p className="text-gray-400 mt-2">This run will be permanently deleted.</p>
    <div className="flex gap-3 mt-6">
      <button className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-white">
        Keep It
      </button>
      <button className="flex-1 py-3 rounded-xl font-semibold bg-red-500 text-white">
        Discard
      </button>
    </div>
  </div>
</div>
```

### Pattern 4: Async Settings Loading
**What:** Load settings via `getSettings()` in useEffect, use defaults until loaded.
**When to use:** RunSummaryView needs bodyWeightKg for calorie calculation.
**Example:**
```typescript
const [settings, setSettings] = useState<AppSettings | null>(null);
useEffect(() => { getSettings().then(setSettings); }, []);
const weight = settings?.bodyWeightKg ?? 70;
```

### Anti-Patterns to Avoid
- **Re-implementing map rendering:** Do NOT create a separate map component. Either reuse MapView with new props or use maplibre-gl directly in RunSummaryView (since MapView currently has navigation-specific logic baked in).
- **Modifying endRun() to handle UI flow:** The hook should remain pure. Flow changes belong in page.tsx callbacks.
- **Storing calorie data in CompletedRun:** Calories are derived from distance + weight. Calculate on display, do not persist (weight may change).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pace formatting | Custom string formatting | `computeAveragePace()` + `formatPace()` from metrics.ts | Already handles edge cases, unit conversion |
| Distance formatting | Custom km/miles conversion | `formatMetricDistance()` from metrics.ts | Already handles both unit systems |
| Time formatting | Custom elapsed formatter | `formatElapsed()` from metrics.ts | Already handles hours/minutes/seconds |
| IndexedDB operations | Raw IDB calls | `dbDelete()`, `dbGet()` from db.ts | Consistent with codebase pattern |
| Settings persistence | Custom storage | `getSettings()`, `saveSettings()` from storage.ts | Established pattern |

**Key insight:** All stat formatting and data access patterns are already implemented. The summary view is primarily a composition task.

## Common Pitfalls

### Pitfall 1: Not Capturing CompletedRun Before Reset
**What goes wrong:** Calling `runSession.reset()` clears all run data. If reset happens before capturing the CompletedRun, summary has no data to display.
**Why it happens:** Current EndRunDialog handler calls `endRun()`, then immediately `reset()` and `setView('map')`.
**How to avoid:** Capture the CompletedRun returned by `endRun()` into state, show summary view, and only call `reset()` after save/discard completes.
**Warning signs:** Summary showing zeros or crashes on undefined data.

### Pitfall 2: Route Data Lost After EndRun
**What goes wrong:** The `route` state in page.tsx holds the planned route. If it gets cleared during end-run flow, the summary cannot overlay planned vs actual.
**Why it happens:** Current flow does `setView('map')` which could trigger route clearing logic.
**How to avoid:** Keep `route` state intact until summary is dismissed. Clear route when returning to generate view after save/discard.
**Warning signs:** Summary map showing only actual trace without planned route.

### Pitfall 3: MapLibre Instance Conflicts
**What goes wrong:** Two map instances (background MapView + summary map) may conflict or cause memory issues.
**Why it happens:** MapView is always mounted (behind overlays). Creating another map in RunSummaryView means two simultaneous instances.
**How to avoid:** Option A: Hide the background MapView when summary is shown. Option B: Use a dedicated smaller map container in RunSummaryView that is independent. Option B is simpler and safer.
**Warning signs:** Map rendering glitches, high memory usage, WebGL context errors.

### Pitfall 4: Weight Unit Conversion in Settings
**What goes wrong:** User enters weight in lbs (imperial setting) but it gets stored/used as kg without conversion.
**Why it happens:** The units setting affects display but internal storage should always be kg.
**How to avoid:** Store `bodyWeightKg` always in kg internally. In Settings UI, display/accept lbs when units=miles, and convert on save: `kg = lbs / 2.20462`.
**Warning signs:** Calorie calculations wildly off for imperial users.

### Pitfall 5: Fade-in Animation on SSR/Hydration
**What goes wrong:** CSS animations may flash or not trigger correctly on initial render.
**Why it happens:** Component renders server-side without animation state.
**How to avoid:** Use a simple CSS animation with `@keyframes` or inline Tailwind `animate-` class. Since this is a client component ('use client'), this is low risk. A simple approach: render with `opacity-0` initially, then `opacity-100 transition-opacity duration-500` via state toggle in useEffect.

## Code Examples

### Calorie Estimation Utility
```typescript
// src/lib/calories.ts
/**
 * Estimate calories burned during a run.
 * Formula: distance_km * body_weight_kg * 1.036
 * Source: User-specified formula (simplified MET-based approximation)
 */
export function estimateCalories(
  distanceMeters: number,
  bodyWeightKg: number
): number {
  const distanceKm = distanceMeters / 1000;
  return Math.round(distanceKm * bodyWeightKg * 1.036);
}
```

### RunSummaryView Component Shape
```typescript
// src/components/RunSummaryView.tsx
interface RunSummaryViewProps {
  completedRun: CompletedRun;
  route: GeneratedRoute | null;
  onSave: () => void;
  onDiscard: () => void;
}
```

### Weight Input in Settings
```typescript
// In SettingsView.tsx, add weight input section
// Store internally as kg, display as lbs when units === 'miles'
const displayWeight = settings.units === 'miles'
  ? Math.round((settings.bodyWeightKg ?? 70) * 2.20462)
  : (settings.bodyWeightKg ?? 70);

const handleWeightChange = (value: number) => {
  const kg = settings.units === 'miles' ? value / 2.20462 : value;
  setSettings({ ...settings, bodyWeightKg: kg });
};
```

### Map Bounds for Summary
```typescript
// Fit bounds to include both planned route and actual trace
const bounds = new maplibregl.LngLatBounds();
route.polyline.forEach(coord => bounds.extend(coord as [number, number]));
completedRun.trace.forEach(p => bounds.extend([p.lng, p.lat]));
map.fitBounds(bounds, { padding: 40 });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline map in every view | Shared background MapView | Phase 1 | Summary needs its own map instance or must manipulate shared one |
| localStorage | IndexedDB via db.ts | Phase 1 | All persistence uses dbPut/dbGet/dbDelete |

**No deprecated patterns relevant to this phase.**

## Open Questions

1. **Map rendering approach for summary**
   - What we know: MapView is always rendered as background. RunSummaryView needs its own map showing planned route + actual trace.
   - What's unclear: Whether creating a second maplibre-gl instance causes WebGL context issues on mobile Safari.
   - Recommendation: Use a separate small map instance in RunSummaryView. Mobile Safari supports multiple WebGL contexts. If issues arise, fall back to hiding the background MapView when summary is shown.

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
| SUMM-01 | Stats display (distance, time, pace) | unit | `npx vitest run src/lib/__tests__/metrics.test.ts -x` | Already covered by existing metrics tests |
| SUMM-02 | Map with GPS trace overlay | manual-only | Visual verification | N/A - MapLibre rendering |
| SUMM-03 | Save/discard flow | unit | `npx vitest run src/lib/__tests__/calories.test.ts -x` | Wave 0 (db operations already tested) |
| SUMM-04 | Calorie estimation | unit | `npx vitest run src/lib/__tests__/calories.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/calories.test.ts` -- covers SUMM-04 calorie estimation
- [ ] `src/lib/calories.ts` -- calorie estimation function (needed before tests)

*(Existing metrics tests already cover SUMM-01 formatting. DB tests already cover SUMM-03 persistence.)*

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/types/index.ts`, `src/lib/metrics.ts`, `src/lib/db.ts`, `src/lib/storage.ts` -- verified all existing types and utilities
- Project codebase: `src/hooks/useRunSession.ts` -- verified endRun() returns CompletedRun and persists to IndexedDB
- Project codebase: `src/components/MapView.tsx` -- verified GeoJSON polyline rendering pattern
- Project codebase: `src/components/EndRunDialog.tsx` -- verified dialog styling pattern
- Project codebase: `src/app/page.tsx` -- verified current end-run flow and view switching

### Secondary (MEDIUM confidence)
- MapLibre GL JS documentation -- multiple WebGL context support on mobile

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing
- Architecture: HIGH -- straightforward composition of existing patterns
- Pitfalls: HIGH -- identified from direct code analysis of current flow
- Calorie formula: HIGH -- user-specified, no ambiguity

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain, no external API dependencies)
