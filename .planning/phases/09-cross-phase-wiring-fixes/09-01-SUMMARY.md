---
phase: 09-cross-phase-wiring-fixes
plan: 01
subsystem: ui
tags: [indexeddb, polyline, run-history, completedrun]

# Dependency graph
requires:
  - phase: 02-run-session
    provides: useRunSession hook with endRun returning CompletedRun
  - phase: 07-visualization
    provides: RunDetailOverlay reading routePolyline from CompletedRun
provides:
  - routePolyline persisted on CompletedRun in IndexedDB for history detail view
affects: [run-history, visualization]

# Tech tracking
tech-stack:
  added: []
  patterns: [post-save augmentation pattern for attaching route context to completed runs]

key-files:
  created: []
  modified: [src/app/page.tsx]

key-decisions:
  - "Kept startRun(null) since GeneratedRoute has no id field; routeId wiring deferred"
  - "Augment CompletedRun in page.tsx after endRun returns rather than inside useRunSession hook"

patterns-established:
  - "Post-save re-put pattern: attach extra data to completed run after initial save, then dbPut to update IndexedDB"

requirements-completed: [HIST-03, VIZ-01]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 09 Plan 01: Cross-Phase Wiring Fixes Summary

**Attach route polyline to CompletedRun before IndexedDB save so RunDetailOverlay shows planned route gradient for historical runs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T22:58:33Z
- **Completed:** 2026-03-20T23:01:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- CompletedRun objects now include routePolyline when a route was active during the run
- RunDetailOverlay can display the planned route gradient for historical runs (data was missing before)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire routePolyline into CompletedRun save flow** - `a113248` (feat)

## Files Created/Modified
- `src/app/page.tsx` - Added dbPut import, attached route.polyline to CompletedRun after endRun, re-saves to IndexedDB

## Decisions Made
- Kept `startRun(null)` instead of plan's `startRun(route?.id ?? null)` because GeneratedRoute has no `id` field. The routeId is already null in the existing flow. Saved routes use a separate `SavedRoute` wrapper with id, but that id is not propagated to the `route` state.
- Augmentation done in page.tsx after endRun returns (not inside useRunSession.ts) to keep the hook clean and generic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GeneratedRoute has no id field**
- **Found during:** Task 1 (Wire routePolyline into CompletedRun save flow)
- **Issue:** Plan specified `runSession.startRun(route?.id ?? null)` but GeneratedRoute type has no `id` property, causing TypeScript error TS2339
- **Fix:** Kept original `startRun(null)` call since routeId cannot be derived from GeneratedRoute
- **Files modified:** src/app/page.tsx
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** a113248 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in plan specification)
**Impact on plan:** Minor -- routeId was already null in the original code. The critical change (polyline attachment) works as planned.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- routePolyline is now available on CompletedRun objects in IndexedDB
- RunDetailOverlay (already reads run.routePolyline) will display planned route gradient for historical runs
- Ready for plan 09-02

---
*Phase: 09-cross-phase-wiring-fixes*
*Completed: 2026-03-20*
