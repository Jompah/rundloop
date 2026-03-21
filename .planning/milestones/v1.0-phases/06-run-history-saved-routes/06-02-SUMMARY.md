---
phase: 06-run-history-saved-routes
plan: 02
subsystem: ui
tags: [react, maplibre-gl, indexeddb, history, run-detail]

requires:
  - phase: 06-run-history-saved-routes
    provides: "RouteThumbnail component, SavedRoute type, db utilities, CompletedRun type"
provides:
  - "RunHistoryView -- scrollable card list of completed runs"
  - "RunDetailOverlay -- full-screen run detail with map and stats"
  - "DeleteRunDialog -- confirmation dialog for run deletion"
affects: [06-run-history-saved-routes]

tech-stack:
  added: []
  patterns: ["refreshKey prop pattern for parent-triggered IndexedDB re-fetch"]

key-files:
  created:
    - src/components/RunHistoryView.tsx
    - src/components/RunDetailOverlay.tsx
    - src/components/DeleteRunDialog.tsx
  modified: []

key-decisions:
  - "Used button elements for history cards for accessibility and keyboard support"
  - "Calorie estimate uses simple 60 kcal/km fallback in detail overlay (no settings dependency)"
  - "Map is non-interactive in detail overlay matching UI spec"

patterns-established:
  - "refreshKey prop pattern: parent increments a counter to trigger child useEffect re-fetch from IndexedDB"

requirements-completed: [HIST-01, HIST-02, HIST-03, HIST-04]

duration: 3min
completed: 2026-03-20
---

# Phase 06 Plan 02: Run History UI Summary

**Run history card list with sorted completed runs, full-screen detail overlay with MapLibre map and stats, and delete confirmation dialog**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T13:22:21Z
- **Completed:** 2026-03-20T13:25:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- RunHistoryView loads completed runs from IndexedDB sorted newest-first, filtering out crash recovery snapshots
- RunDetailOverlay displays GPS trace and planned route on MapLibre map with stats card
- DeleteRunDialog follows DiscardConfirmDialog pattern for consistent UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RunHistoryView with card list** - `db6f9b4` (feat)
2. **Task 2: Create RunDetailOverlay and DeleteRunDialog** - `c75c285` (feat)

## Files Created/Modified
- `src/components/RunHistoryView.tsx` - Scrollable card list with date, distance, time, pace, and RouteThumbnail per run
- `src/components/RunDetailOverlay.tsx` - Full-screen overlay with MapLibre map, stats card, and delete button
- `src/components/DeleteRunDialog.tsx` - Confirmation dialog cloning DiscardConfirmDialog pattern

## Decisions Made
- Used button elements for history cards for accessibility (keyboard navigation, screen readers)
- Calorie estimate uses simple 60 kcal/km fallback without settings dependency to keep detail overlay self-contained
- Map is non-interactive (no zoom/pan) in detail overlay per UI spec

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- History view and detail overlay ready for wiring into page.tsx (Plan 04)
- refreshKey prop ready for parent to trigger re-fetch after delete

---
*Phase: 06-run-history-saved-routes*
*Completed: 2026-03-20*
