---
phase: 03-live-run-metrics
plan: 01
subsystem: metrics
tags: [vitest, tdd, haversine, pace-calculation, pure-functions]

requires:
  - phase: 01-data-engine
    provides: haversineMeters distance calculation and FilteredPosition type
provides:
  - Pure metric computation functions (rolling pace, average pace, formatting)
  - Shared formatElapsed replacing inline copies
affects: [03-live-run-metrics, 04-navigation]

tech-stack:
  added: []
  patterns: [pure-function metrics layer, TDD red-green workflow]

key-files:
  created:
    - src/lib/metrics.ts
    - src/lib/__tests__/metrics.test.ts
  modified: []

key-decisions:
  - "Guard computeAveragePace at < 10m distance threshold to avoid wildly inaccurate pace from GPS noise"
  - "Rolling pace window defaults to 30s matching typical GPS update cadence for smooth readings"

patterns-established:
  - "Pure metrics pattern: all computation functions are pure (no side effects, no React deps), enabling direct unit testing"
  - "Import haversineMeters from storage.ts as single source of truth for distance calculations"

requirements-completed: [METR-01, METR-02, METR-03, METR-04]

duration: 2min
completed: 2026-03-20
---

# Phase 03 Plan 01: Pure Metrics Computation Summary

**TDD-driven pure metrics layer with 6 functions for rolling pace, average pace, distance formatting, and elapsed time -- 20 tests passing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T08:54:21Z
- **Completed:** 2026-03-20T08:55:57Z
- **Tasks:** 2 (TDD red + green)
- **Files modified:** 2

## Accomplishments
- computeRollingPace using 30s sliding window with haversineMeters for GPS trace pace
- computeAveragePace, formatPace (km/miles), formatMetricDistance, computeRemainingDistance
- Shared formatElapsed function replacing inline copies in NavigationView
- 20 unit tests covering all edge cases (null inputs, zero distance, clamping)

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests** - `3271414` (test)
2. **GREEN: Implementation** - `f943a6f` (feat)

_TDD workflow: test-first then minimal implementation_

## Files Created/Modified
- `src/lib/metrics.ts` - Pure metric computation and formatting functions (6 exports)
- `src/lib/__tests__/metrics.test.ts` - 20 unit tests covering all metric functions

## Decisions Made
- Guard computeAveragePace at < 10m distance (not 0m) to avoid GPS noise producing infinite pace
- Rolling pace uses 30s default window for smooth readings at typical GPS update frequency
- formatPace uses Math.round for seconds to avoid floating point display issues

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Metrics layer ready for Plan 02 (RunMetricsOverlay component)
- All 6 functions exported and tested, ready to be consumed by UI components
- formatElapsed can replace inline copy in NavigationView when wiring up

---
*Phase: 03-live-run-metrics*
*Completed: 2026-03-20*
