---
phase: 02-run-session-lifecycle
plan: 01
subsystem: hooks
tags: [react, useReducer, state-machine, gps, haversine, wake-lock, crash-recovery]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: "GPS filter, crash recovery, wake lock, IndexedDB, types"
provides:
  - "useRunSession hook with run lifecycle state machine"
  - "runReducer pure function for testable state transitions"
  - "computeDistance haversine accumulator for GPS traces"
affects: [02-run-session-lifecycle, 03-metrics, 04-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns: [useReducer state machine, guarded transitions, wall-clock timer, ref-based mutable data]

key-files:
  created:
    - src/hooks/useRunSession.ts
    - src/hooks/__tests__/useRunSession.test.ts

key-decisions:
  - "Exported runReducer and computeDistance as named exports for direct unit testing without React rendering"
  - "Used useRef for trace array and timing data to avoid re-renders on every GPS point"
  - "Timer uses wall-clock math (Date.now() - startTime - pausedDuration) not interval increments"

patterns-established:
  - "State machine pattern: useReducer with guarded transitions returning unchanged state for invalid actions"
  - "Side effect coordination: useEffect keyed on status field for GPS watcher and timer lifecycle"

requirements-completed: [RUN-01, RUN-02]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 02 Plan 01: Run Session Lifecycle Summary

**useReducer state machine hook with guarded idle/active/paused/completed transitions, GPS watcher, wall-clock timer, wake lock, and crash recovery snapshot integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T07:45:36Z
- **Completed:** 2026-03-20T07:48:04Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Pure runReducer with 6 action types and guarded transitions for all invalid state changes
- computeDistance haversine accumulator tested with edge cases (empty, single, multi-segment)
- Full hook with coordinated side effects: GPS watcher, 100ms timer, wake lock, crash recovery snapshots
- 15 unit tests passing covering all reducer transitions and distance computation

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for reducer and computeDistance** - `39eaa69` (test)
2. **Task 1 GREEN: Implement useRunSession hook** - `3bebbab` (feat)

_TDD task: test file committed first (RED), then implementation (GREEN)._

## Files Created/Modified
- `src/hooks/useRunSession.ts` - Run session state machine hook (410 lines)
- `src/hooks/__tests__/useRunSession.test.ts` - Unit tests for reducer and computeDistance (186 lines)

## Decisions Made
- Exported runReducer and computeDistance as named exports for direct testing (no React rendering needed)
- Used useRef for trace, timing refs to avoid re-renders on high-frequency GPS updates
- Timer uses wall-clock math ensuring accuracy across tab suspensions
- Inline copy of haversine formula (same pattern as Phase 1 gps-filter.ts)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- useRunSession hook ready for UI wiring in Plan 02
- All Phase 1 infrastructure integrations verified (gps-filter, crash-recovery, wake-lock, db)
- Pre-existing type errors in other files (async storage migration) are out of scope for this plan

---
*Phase: 02-run-session-lifecycle*
*Completed: 2026-03-20*
