# Phase 5: Run Summary - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a post-run summary/reward screen shown after the runner completes or ends a run. Displays achievement stats, GPS trace overlaid on the planned route, and offers save or discard actions.

</domain>

<decisions>
## Implementation Decisions

### Summary Screen Layout & Content
- Display 4 key stats: total distance, elapsed time, average pace, estimated calories burned
- Map shows GPS trace overlaid on planned route — runner sees how well they followed
- Layout: map on top half, stats card below, save/discard buttons at bottom
- Subtle fade-in animation for achievement feel — not over the top

### Save/Discard Flow
- "Save" keeps run in IndexedDB history (endRun already persists it; save = keep)
- "Discard" deletes from IndexedDB with "Are you sure?" confirmation dialog
- After save or discard, return to map view (route generator) — clean slate
- Summary is a one-time view after each run; saved runs accessible later via history (Phase 6)

### Calorie Estimation
- Simple running calorie formula: `distance_km * body_weight_kg * 1.036`
- Body weight configurable in Settings screen as optional numeric input (kg)
- Default 70kg if not set — show calories with small note "Update weight in Settings for accuracy"
- Weight display follows existing units setting: kg for metric, lbs for imperial (auto-convert)

### Claude's Discretion
- Exact stats card visual design (colors, spacing, typography within dark theme)
- Map zoom/bounds behavior for the summary view
- Fade-in animation timing and easing
- Discard confirmation dialog styling

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CompletedRun` type: `{ id, startTime, endTime, elapsedMs, distanceMeters, trace, routeId }`
- `metrics.ts`: `formatPace()`, `formatMetricDistance()`, `formatElapsed()`, `computeAveragePace()`
- `db.ts`: `dbPut()`, `dbGet()`, `dbDelete()`, `dbGetAll()` for IndexedDB operations
- `storage.ts`: `getSettings()`, `saveSettings()` with `AppSettings` type
- `MapView.tsx`: Route line rendering, user location marker, center-on-user
- `EndRunDialog.tsx`: Established dialog pattern (dark theme, rounded, two-button)
- Dark theme palette: bg-gray-900/95, text-white, green-400 accent

### Established Patterns
- `useRunSession.endRun()` already saves CompletedRun to IndexedDB
- View switching in page.tsx via state (`view: 'map' | 'settings' | ...`)
- Settings loaded async with useState + useEffect pattern (fixed in Phase 4)
- Tailwind 4 + dark theme for all UI

### Integration Points
- `page.tsx` needs `showSummary` state + `completedRunData` to hold run for display
- After EndRunDialog confirm → show RunSummaryView instead of returning to map
- `AppSettings` needs `bodyWeightKg?: number` field
- `SettingsView.tsx` needs weight input field
- Load route data via `routeId` from CompletedRun for overlay display

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
