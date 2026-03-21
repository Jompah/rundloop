---
phase: 04-navigation-polish
plan: 01
subsystem: navigation
tags: [geolocation, heading, compass, milestones, tts, ios-safari, equirectangular]

requires:
  - phase: 01-data-layer
    provides: "FilteredPosition type, haversine distance, storage"
  - phase: 03-metrics-display
    provides: "formatPace, computeAveragePace for milestone pace display"
provides:
  - "Pure navigation utilities: pointToSegmentDistance, distanceToRoute, findNearestSegmentIndex"
  - "Compass direction and heading smoothing: getCompassDirection, smoothHeading, bearingBetween"
  - "Milestone detection and formatting: detectMilestone, formatMilestoneMessage"
  - "iOS audio unlock: unlockIOSAudio, ensureSpeechReady"
affects: [04-navigation-polish, 05-off-route-detection]

tech-stack:
  added: []
  patterns: [equirectangular-projection, ema-heading-smoothing, idempotent-milestone-set, ios-silent-utterance-unlock]

key-files:
  created:
    - src/lib/navigation.ts
    - src/lib/milestones.ts
    - src/lib/__tests__/navigation.test.ts
    - src/lib/__tests__/milestones.test.ts
    - src/lib/__tests__/voice.test.ts
  modified:
    - src/lib/voice.ts

key-decisions:
  - "Equirectangular projection with cos(lat) correction for point-to-segment distance (accurate at running scales < 50km)"
  - "EMA heading smoothing with 360/0 wrap-around handling using shortest-arc diff"
  - "getSynth updated to check globalThis fallback for test environment compatibility"

patterns-established:
  - "Pure navigation functions accept (lat, lng) as separate params; polylines destructured as [lng, lat]"
  - "Milestone detection mutates a Set for idempotent tracking of announced milestones"
  - "iOS audio unlock via silent SpeechSynthesisUtterance with volume=0, guarded by module-level flag"

requirements-completed: [NAV-01, NAV-02, NAV-03, NAV-05]

duration: 3min
completed: 2026-03-20
---

# Phase 4 Plan 1: Navigation Utilities Summary

**Pure navigation math (point-to-segment, compass, heading smoothing), milestone detection with 3 voice styles, and iOS audio unlock via silent utterance**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T10:20:31Z
- **Completed:** 2026-03-20T10:24:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All 6 navigation utility functions with equirectangular projection and proper [lng, lat] polyline handling
- Milestone detection (km/miles) with idempotent Set tracking and 3 voice style formatters
- iOS Safari audio unlock and speech reset functions added to voice.ts
- 47 comprehensive unit tests covering all exports

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD navigation.ts and milestones.ts** - `045c890` (feat)
2. **Task 2: TDD voice.ts iOS audio unlock** - `9eb4d4f` (feat)

## Files Created/Modified
- `src/lib/navigation.ts` - Pure functions: pointToSegmentDistance, distanceToRoute, findNearestSegmentIndex, getCompassDirection, smoothHeading, bearingBetween
- `src/lib/milestones.ts` - detectMilestone, formatMilestoneMessage, VoiceStyle type, MilestoneEvent interface
- `src/lib/voice.ts` - Added unlockIOSAudio (idempotent silent utterance) and ensureSpeechReady (cancel reset)
- `src/lib/__tests__/navigation.test.ts` - 35 tests for all navigation utilities
- `src/lib/__tests__/milestones.test.ts` - 19 tests for milestone detection and formatting
- `src/lib/__tests__/voice.test.ts` - 6 tests for iOS unlock, speak, and stopSpeaking

## Decisions Made
- Equirectangular projection with cos(lat) correction for point-to-segment distance -- accurate enough at running distances, avoids turf.js dependency per user decision
- EMA heading smoothing uses shortest-arc diff calculation to avoid wrap-around through 180 degrees
- Updated getSynth in voice.ts to check globalThis as fallback for vitest node environment compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated getSynth to support globalThis fallback**
- **Found during:** Task 2 (voice.ts TDD GREEN phase)
- **Issue:** vitest runs in node environment where `window` is undefined; the existing `getSynth()` only checked `window.speechSynthesis`, causing all voice tests to fail even with proper vi.stubGlobal mocking
- **Fix:** Added globalThis fallback check in getSynth() after the window check
- **Files modified:** src/lib/voice.ts
- **Verification:** All 6 voice tests pass; existing speak/stopSpeaking behavior preserved
- **Committed in:** 9eb4d4f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for test environment compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All pure utility functions ready for wiring into components (Plan 04-02)
- Navigation math tested with equator and Stockholm-latitude coordinates
- Voice functions ready for iOS Safari PWA deployment

---
*Phase: 04-navigation-polish*
*Completed: 2026-03-20*
