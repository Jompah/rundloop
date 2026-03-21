---
phase: 04-navigation-polish
plan: 02
subsystem: ui
tags: [maplibre, gps, heading, auto-rotation, off-route, haptic, voice, navigation]

# Dependency graph
requires:
  - phase: 04-navigation-polish plan 01
    provides: navigation.ts utility functions (distanceToRoute, smoothHeading, bearingBetween, getCompassDirection, findNearestSegmentIndex), voice.ts speak function
provides:
  - FilteredPosition.heading field in GPS pipeline
  - Map auto-rotation with heading during active navigation
  - Interaction override with re-center button
  - Off-route detection with multi-sensory alerts (banner + haptic + voice)
  - OffRouteBanner component
affects: [04-navigation-polish plan 03, milestone announcements, settings voice toggle]

# Tech tracking
tech-stack:
  added: []
  patterns: [heading-aware map rotation with EMA smoothing, interaction detection via dragstart/zoomstart, off-route state machine with repeat timer]

key-files:
  created:
    - src/components/OffRouteBanner.tsx
  modified:
    - src/types/index.ts
    - src/lib/gps-filter.ts
    - src/components/MapView.tsx
    - src/app/page.tsx
    - src/components/NavigationView.tsx
    - src/hooks/__tests__/useRunSession.test.ts
    - src/lib/__tests__/gps-filter.test.ts
    - src/lib/__tests__/metrics.test.ts

key-decisions:
  - "Show re-center button only when auto-rotation disabled during navigation (not always visible)"
  - "Off-route voice repeats every 30s via setInterval, cleared on return to route"
  - "All speak() calls pass settings.voiceEnabled to respect NAV-04 mute toggle"

patterns-established:
  - "Heading smoothing: EMA alpha=0.3 with speed gate (>1.0 m/s) before using GPS heading"
  - "Interaction override: dragstart/zoomstart disable auto-rotation, re-center button restores it"
  - "Off-route state machine: announced ref prevents duplicate alerts, repeat timer for sustained off-route"

requirements-completed: [NAV-01, NAV-02, NAV-04]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 04 Plan 02: Map Auto-Rotation and Off-Route Detection Summary

**Heading-aware map auto-rotation with 30-degree pitch, interaction override with re-center button, and off-route detection with banner/haptic/voice alerts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T10:26:03Z
- **Completed:** 2026-03-20T10:30:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- FilteredPosition.heading threaded through entire GPS pipeline (types -> filter -> page -> MapView)
- Map auto-rotates following runner heading during navigation with 30-degree forward pitch and zoom 16
- Manual pan/zoom disables auto-rotation and shows 48px re-center button
- Off-route banner with amber styling slides in when runner deviates >50m from route
- Multi-sensory alert: visual banner + haptic vibration pattern + voice announcement with compass direction
- Banner auto-dismisses and "Back on route" announced when runner returns within 50m
- All voice announcements respect voiceEnabled toggle (NAV-04 mute compliance)

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread heading through types and GPS filter, update MapView with auto-rotation** - `d18a867` (feat)
2. **Task 2: Off-route detection with banner, haptic, and voice alert** - `92982d3` (feat)

## Files Created/Modified
- `src/types/index.ts` - Added heading field to FilteredPosition interface
- `src/lib/gps-filter.ts` - Pass heading through from GeoPosition to FilteredPosition
- `src/components/MapView.tsx` - Auto-rotation with heading, interaction detection, re-center button
- `src/app/page.tsx` - Thread userHeading and userSpeed state to MapView
- `src/components/OffRouteBanner.tsx` - New off-route alert banner with amber styling
- `src/components/NavigationView.tsx` - Off-route detection logic with voice/haptic alerts
- `src/hooks/__tests__/useRunSession.test.ts` - Added heading field to test fixtures
- `src/lib/__tests__/gps-filter.test.ts` - Added heading field to test fixtures
- `src/lib/__tests__/metrics.test.ts` - Added heading field to test fixtures

## Decisions Made
- Re-center button only visible when auto-rotation is disabled during navigation (hidden otherwise)
- Off-route voice announcement repeats every 30 seconds via setInterval, cleared on route return
- All speak() calls pass settings.voiceEnabled to respect NAV-04 mute toggle consistently

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added heading field to test fixtures**
- **Found during:** Task 1 (heading field addition to FilteredPosition)
- **Issue:** Three test files had FilteredPosition objects missing the new required heading field
- **Fix:** Added `heading: null` to all FilteredPosition literals in test files
- **Files modified:** src/hooks/__tests__/useRunSession.test.ts, src/lib/__tests__/gps-filter.test.ts, src/lib/__tests__/metrics.test.ts
- **Verification:** All 100 tests pass
- **Committed in:** d18a867 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test fixture update was necessary for type correctness after adding heading field. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Map rotation and off-route detection fully wired for active navigation
- Ready for Plan 03 (milestone announcements and voice style settings)
- settings.voiceEnabled already threaded for NAV-04 compliance

---
*Phase: 04-navigation-polish*
*Completed: 2026-03-20*
