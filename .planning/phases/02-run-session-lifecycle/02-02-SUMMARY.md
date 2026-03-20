---
phase: 02-run-session-lifecycle
plan: 02
subsystem: ui
tags: [react, dialogs, pause-resume, crash-recovery, gps-filter, navigation]

# Dependency graph
requires:
  - phase: 02-run-session-lifecycle
    provides: "useRunSession hook with run lifecycle state machine"
  - phase: 01-infrastructure
    provides: "GPS filter, crash recovery, wake lock, voice, types"
provides:
  - "EndRunDialog confirmation modal component"
  - "CrashRecoveryDialog recovery modal component"
  - "NavigationView with pause/resume/end controls and PAUSED overlay"
  - "page.tsx wired with useRunSession, crash recovery, and GPS filtering"
affects: [03-metrics, 04-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns: [dialog overlay pattern, run control state-driven UI]

key-files:
  created:
    - src/components/EndRunDialog.tsx
    - src/components/CrashRecoveryDialog.tsx
  modified:
    - src/components/NavigationView.tsx
    - src/app/page.tsx

key-decisions:
  - "Inline haversine in CrashRecoveryDialog for snapshot distance computation (avoids importing from hook)"
  - "Run controls conditionally rendered based on runStatus prop (active shows Pause+End, paused shows Resume+End)"
  - "Fallback Stop button shown when runStatus is neither active nor paused for edge cases"

patterns-established:
  - "Dialog overlay pattern: fixed inset-0 z-50 with bg-black/60 backdrop and centered card"
  - "Run status-driven UI: conditionally render controls based on RunStatus type"

requirements-completed: [RUN-01, RUN-02, RUN-03, RUN-04]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 02 Plan 02: Run Session UI Wiring Summary

**Pause/resume/end run controls in NavigationView with EndRunDialog confirmation, CrashRecoveryDialog on mount, and watchFilteredPosition replacing raw GPS**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T07:49:56Z
- **Completed:** 2026-03-20T07:53:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- EndRunDialog and CrashRecoveryDialog modal components with consistent overlay styling
- NavigationView updated with pause/resume/end buttons, elapsed time display, pulsing PAUSED overlay, and voice stop on pause
- page.tsx fully wired with useRunSession hook, crash recovery detection on mount, and GPS filter replacement
- All 33 existing tests continue to pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EndRunDialog and CrashRecoveryDialog** - `a17e113` (feat)
2. **Task 2: Wire useRunSession into NavigationView and page.tsx** - `c66d5a4` (feat)

## Files Created/Modified
- `src/components/EndRunDialog.tsx` - End run confirmation modal with "End Run" / "Keep Going" buttons
- `src/components/CrashRecoveryDialog.tsx` - Crash recovery modal showing distance, time, date with "Resume" / "Discard"
- `src/components/NavigationView.tsx` - Updated with run controls, elapsed time, PAUSED overlay, voice stop
- `src/app/page.tsx` - Wired useRunSession, crash recovery, EndRunDialog, CrashRecoveryDialog, watchFilteredPosition

## Decisions Made
- Inline haversine in CrashRecoveryDialog rather than importing from hook (keeps component self-contained)
- Run controls are conditionally rendered based on runStatus prop for clear state-driven UI
- Added fallback Stop button when runStatus is neither active nor paused (edge case safety)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full run lifecycle UI complete: start -> pause -> resume -> end with confirmation
- Crash recovery wired and functional on app mount
- GPS filtering active via watchFilteredPosition
- Pre-existing type errors in other files (async storage migration) remain out of scope
- Ready for Phase 03 (metrics/stats) and Phase 04 (navigation enhancements)

---
*Phase: 02-run-session-lifecycle*
*Completed: 2026-03-20*
