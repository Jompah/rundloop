---
phase: 01-storage-gps-foundation
plan: 01
subsystem: database
tags: [indexeddb, persistence, migration, storage-api]

# Dependency graph
requires:
  - phase: 01-storage-gps-foundation/01-00
    provides: "vitest + fake-indexeddb test infrastructure, skeleton test files"
provides:
  - "IndexedDB persistence layer with singleton connection and CRUD helpers"
  - "localStorage to IndexedDB migration"
  - "Storage persistence request (navigator.storage.persist)"
  - "Run, FilteredPosition, ActiveRunSnapshot, CompletedRun types"
  - "Async storage.ts API backed by IndexedDB"
  - "Exported haversineMeters utility"
affects: [gps-filter, wake-lock, run-tracker, route-generator, settings, history]

# Tech tracking
tech-stack:
  added: []
  patterns: [promise-wrapped-indexeddb, singleton-db-connection, one-time-migration]

key-files:
  created: [src/lib/db.ts]
  modified: [src/types/index.ts, src/lib/storage.ts]

key-decisions:
  - "Used raw IndexedDB API with promise wrappers (no idb/idb-keyval dependency)"
  - "All storage.ts functions made async; consumer updates deferred to Phase 2+"

patterns-established:
  - "Promise-wrapped IndexedDB: all DB operations return Promises via getDB() singleton"
  - "SSR guard pattern: return defaults when typeof window === 'undefined'"
  - "Migration flag pattern: localStorage key 'rundloop_migrated_to_idb' prevents re-migration"

requirements-completed: [STOR-01, STOR-02, STOR-03, STOR-04]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 01 Plan 01: IndexedDB Persistence Layer Summary

**Raw IndexedDB persistence with 3 object stores (runs/routes/settings), localStorage migration, storage persistence request, and async storage.ts API**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T06:44:26Z
- **Completed:** 2026-03-20T06:46:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- IndexedDB database 'rundloop' v1 with runs (startTime index), routes, and settings stores
- Generic CRUD helpers (dbGet, dbPut, dbDelete, dbGetAll, dbGetAllByIndex) with promise wrappers
- One-time localStorage migration that reads existing data, writes to IndexedDB, and clears old keys
- Storage persistence requested via navigator.storage.persist() to prevent iOS eviction
- storage.ts rewritten to delegate all persistence to IndexedDB while keeping same export names
- haversineMeters exported for reuse by GPS filter pipeline
- New types: FilteredPosition, ActiveRunSnapshot, CompletedRun, Run

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IndexedDB layer and new types** - `8a65260` (feat)
2. **Task 2: Update storage.ts to delegate to IndexedDB** - `9ca3a31` (feat)

## Files Created/Modified
- `src/lib/db.ts` - IndexedDB singleton connection, schema, CRUD helpers, migration, persistence request
- `src/types/index.ts` - Added FilteredPosition, ActiveRunSnapshot, CompletedRun, Run types
- `src/lib/storage.ts` - Rewritten to async, delegates to db.ts, exports haversineMeters

## Decisions Made
- Used raw IndexedDB API with promise wrappers instead of idb or idb-keyval library (per research recommendation -- avoids dependency for 3 simple stores)
- All storage.ts functions made async; consumer TypeScript errors are expected and will be resolved when those components are refactored in later phases

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IndexedDB layer ready for GPS filter (01-02) and wake lock (01-03) plans
- Consumer components (page.tsx, SettingsView, HistoryView, etc.) have expected TypeScript errors from async change -- will be updated in Phase 2+
- Test file `src/lib/__tests__/db.test.ts` has todo stubs ready for implementation

---
*Phase: 01-storage-gps-foundation*
*Completed: 2026-03-20*
