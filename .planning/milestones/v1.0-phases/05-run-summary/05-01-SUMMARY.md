---
phase: 05-run-summary
plan: 01
subsystem: ui
tags: [calories, settings, types, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: AppSettings type, storage layer, vitest setup
provides:
  - estimateCalories utility function with tests
  - bodyWeightKg field on AppSettings
  - summary value on AppView union type
  - Body weight input in SettingsView with kg/lbs conversion
affects: [05-run-summary plan 02 (RunSummaryView)]

# Tech tracking
tech-stack:
  added: []
  patterns: [unit-aware weight display with internal kg storage]

key-files:
  created:
    - src/lib/calories.ts
    - src/lib/__tests__/calories.test.ts
  modified:
    - src/types/index.ts
    - src/components/SettingsView.tsx

key-decisions:
  - "Body weight stored internally as kg; converted to lbs for display when units=miles"
  - "bodyWeightKg is optional on AppSettings; fallback to 70kg handled in display code"

patterns-established:
  - "Unit-aware numeric input: store metric internally, convert for display based on units setting"

requirements-completed: [SUMM-04]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 05 Plan 01: Calorie Estimation and Types Summary

**estimateCalories utility with TDD tests, bodyWeightKg/summary type extensions, and unit-aware weight input in Settings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T11:44:33Z
- **Completed:** 2026-03-20T11:47:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created estimateCalories function using distance_km * bodyWeightKg * 1.036 formula, verified with 4 TDD test cases
- Extended AppSettings with optional bodyWeightKg field and AppView with 'summary' value
- Added body weight input to SettingsView with automatic kg/lbs conversion based on units setting

## Task Commits

Each task was committed atomically:

1. **Task 1: Calorie utility, types extension, and tests** - `8913840` (feat)
2. **Task 2: Body weight input in SettingsView** - `7ffa319` (feat)

## Files Created/Modified
- `src/lib/calories.ts` - estimateCalories(distanceMeters, bodyWeightKg) utility
- `src/lib/__tests__/calories.test.ts` - 4 test cases for calorie estimation
- `src/types/index.ts` - Added bodyWeightKg to AppSettings, 'summary' to AppView
- `src/components/SettingsView.tsx` - Body weight input with kg/lbs unit conversion

## Decisions Made
- Body weight stored internally as kg; converted to lbs for display when units=miles using 2.20462 factor
- bodyWeightKg is optional on AppSettings (undefined means use 70kg fallback in display code)
- Used existing vitest import pattern (explicit imports from 'vitest') matching metrics.test.ts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- estimateCalories ready for import in RunSummaryView (Plan 02)
- AppView 'summary' type ready for view switching logic
- bodyWeightKg available from settings for calorie display

---
*Phase: 05-run-summary*
*Completed: 2026-03-20*
