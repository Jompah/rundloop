# Phase 2: Run Session Lifecycle - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Run session state machine (idle → active → paused → completed) with pause/resume/end run controls, GPS filter wiring, timer, crash recovery dialog on relaunch. Wires Phase 1 infrastructure (IndexedDB, GPS filter, Wake Lock, crash recovery) into the running app.

</domain>

<decisions>
## Implementation Decisions

### State Machine Architecture
- Custom `useRunSession` hook isolates run lifecycle from UI concerns
- Explicit transition functions: `startRun()`, `pauseRun()`, `resumeRun()`, `endRun()` — clear API, easy to test
- State enum: `idle | active | paused | completed` — no way to reach invalid states
- GPS filter wiring happens in this phase — replace `watchPosition` with `watchFilteredPosition` (Phase 1 TODO at page.tsx line 87)
- Timer uses `useRef`-based interval that pauses with run — simple, accurate, no drift

### Pause/Resume & End Run UI
- Pause/resume button in bottom overlay bar of NavigationView — easy thumb reach while running
- End run uses modal dialog with "End Run" / "Keep Going" — prevents accidental taps
- Voice navigation stops on pause, resumes on unpause
- Paused state shows pulsing pause icon + "PAUSED" text overlay on map — unmistakable

### Crash Recovery UX
- Check for incomplete runs on app mount (useEffect in page.tsx) — immediate detection
- Recovery UI is a modal dialog: "You have an unfinished run. Resume or Discard?"
- Recovery dialog shows: distance covered, elapsed time, date started — helps user decide

### Claude's Discretion
- Exact animation/styling of pause overlay and recovery modal
- Internal state machine transition validation logic
- Timer precision and update interval
- How to handle edge case of recovery + new route generation simultaneously

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 infrastructure (wiring targets)
- `src/lib/gps-filter.ts` — watchFilteredPosition, shouldAcceptPosition (must wire into run session)
- `src/lib/crash-recovery.ts` — startSnapshotSchedule, stopSnapshotSchedule, findIncompleteRun, clearIncompleteRun
- `src/lib/wake-lock.ts` — acquireWakeLock, releaseWakeLock, isWakeLockSupported
- `src/lib/db.ts` — dbPut, dbGet, dbGetAll for run persistence
- `src/types/index.ts` — ActiveRunSnapshot, CompletedRun, FilteredPosition, Run types

### Current app structure
- `src/app/page.tsx` — Main app, line 87 has TODO(Phase-2) for GPS filter wiring
- `src/components/NavigationView.tsx` — Current navigation UI, needs pause/resume controls

### PRD
- `PRD.md` §3 (GPS Navigation) — Navigation requirements
- `PRD.md` §4 (Live Run Metrics) — Metrics overlay requirements (Phase 3, but state machine feeds it)

No external specs or ADRs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/crash-recovery.ts`: Full snapshot/recovery API ready to wire
- `src/lib/gps-filter.ts`: watchFilteredPosition with onAccept callback ready for trace accumulation
- `src/lib/wake-lock.ts`: acquireWakeLock/releaseWakeLock for run start/end
- `src/lib/db.ts`: dbPut/dbGet for persisting completed runs
- `src/types/index.ts`: ActiveRunSnapshot and CompletedRun types match exactly what the state machine needs

### Established Patterns
- SSR safety: `typeof window === 'undefined'` checks
- Custom hooks for logic isolation (useRunSession follows this pattern)
- Dynamic imports for browser-only modules

### Integration Points
- page.tsx: Must add useRunSession hook, crash recovery check on mount, GPS filter wiring
- NavigationView: Must receive run session controls (pause/resume/end) and display state
- Wake Lock: Acquire on startRun, release on endRun/pause, re-acquire on resume

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-run-session-lifecycle*
*Context gathered: 2026-03-20*
