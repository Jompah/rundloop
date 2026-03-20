# Phase 2: Run Session Lifecycle - Research

**Researched:** 2026-03-20
**Domain:** React state machine hook, browser GPS/timer lifecycle, crash recovery UX
**Confidence:** HIGH

## Summary

Phase 2 wires Phase 1 infrastructure (GPS filter, crash recovery, wake lock, IndexedDB) into a cohesive run session lifecycle managed by a custom `useRunSession` hook. The core challenge is implementing a state machine (`idle -> active -> paused -> completed`) that coordinates multiple browser APIs (GPS watcher, wake lock, snapshot scheduler, speech synthesis) with correct pause/resume/cleanup semantics.

All Phase 1 building blocks are already implemented and tested. The work is integration: creating the `useRunSession` hook, modifying `page.tsx` to use it, updating `NavigationView` to show pause/resume/end controls, and adding crash recovery detection on mount. No new external libraries are needed.

**Primary recommendation:** Build `useRunSession` as a pure state machine hook with explicit transition functions. Each transition (`startRun`, `pauseRun`, `resumeRun`, `endRun`) manages all side effects (GPS, wake lock, snapshots, timer) atomically. Use `useReducer` for the state to enforce valid transitions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Custom `useRunSession` hook isolates run lifecycle from UI concerns
- Explicit transition functions: `startRun()`, `pauseRun()`, `resumeRun()`, `endRun()` -- clear API, easy to test
- State enum: `idle | active | paused | completed` -- no way to reach invalid states
- GPS filter wiring happens in this phase -- replace `watchPosition` with `watchFilteredPosition` (Phase 1 TODO at page.tsx line 87)
- Timer uses `useRef`-based interval that pauses with run -- simple, accurate, no drift
- Pause/resume button in bottom overlay bar of NavigationView -- easy thumb reach while running
- End run uses modal dialog with "End Run" / "Keep Going" -- prevents accidental taps
- Voice navigation stops on pause, resumes on unpause
- Paused state shows pulsing pause icon + "PAUSED" text overlay on map -- unmistakable
- Check for incomplete runs on app mount (useEffect in page.tsx) -- immediate detection
- Recovery UI is a modal dialog: "You have an unfinished run. Resume or Discard?"
- Recovery dialog shows: distance covered, elapsed time, date started -- helps user decide

### Claude's Discretion
- Exact animation/styling of pause overlay and recovery modal
- Internal state machine transition validation logic
- Timer precision and update interval
- How to handle edge case of recovery + new route generation simultaneously

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RUN-01 | Run session state machine (idle -> active -> paused -> completed) prevents impossible states | useReducer with guarded transitions; only valid state transitions accepted |
| RUN-02 | User can pause and resume a run with timer and GPS tracking pausing/resuming correctly | Pause stops GPS watcher + timer interval + wake lock + snapshots; resume restarts all |
| RUN-03 | User can end a run with confirmation dialog | Modal dialog component with "End Run" / "Keep Going"; endRun finalizes CompletedRun to IndexedDB |
| RUN-04 | Crashed/interrupted runs detected on app relaunch with option to recover or discard | findIncompleteRun() on mount; recovery modal restores ActiveRunSnapshot into hook state |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (useReducer) | 19.2.4 | State machine for run lifecycle | Already in project; useReducer enforces valid transitions better than useState |
| Phase 1 modules | n/a | GPS filter, crash recovery, wake lock, db | Already built and tested -- this phase wires them |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto.randomUUID() | Built-in | Generate run IDs | Available in all modern browsers, no dependency needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useReducer | XState/zustand | Overkill for 4 states; useReducer is zero-dependency and the codebase already uses hooks |
| Custom timer | `performance.now()` | More precise but unnecessary -- 100ms interval with ref-based elapsed tracking is sufficient |

**Installation:**
```bash
# No new dependencies needed -- all tools already in place
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/
│   └── useRunSession.ts       # State machine hook (NEW)
├── components/
│   ├── NavigationView.tsx      # MODIFY: add pause/resume/end controls
│   ├── EndRunDialog.tsx        # NEW: confirmation modal
│   └── CrashRecoveryDialog.tsx # NEW: recovery modal
├── lib/
│   ├── crash-recovery.ts      # EXISTING: wire into hook
│   ├── gps-filter.ts          # EXISTING: wire into hook
│   ├── wake-lock.ts           # EXISTING: wire into hook
│   └── db.ts                  # EXISTING: wire into hook
└── app/
    └── page.tsx               # MODIFY: add useRunSession, crash recovery check
```

### Pattern 1: useReducer State Machine
**What:** A discriminated union state with a reducer that only allows valid transitions
**When to use:** When you have a finite set of states with defined transitions
**Example:**
```typescript
type RunState = 'idle' | 'active' | 'paused' | 'completed';

type RunAction =
  | { type: 'START'; runId: string; startTime: number }
  | { type: 'PAUSE'; elapsedMs: number }
  | { type: 'RESUME' }
  | { type: 'END'; elapsedMs: number; distanceMeters: number }
  | { type: 'RECOVER'; snapshot: ActiveRunSnapshot }
  | { type: 'RESET' };

// Valid transitions:
// idle -> active (START)
// active -> paused (PAUSE)
// paused -> active (RESUME)
// active -> completed (END)
// paused -> completed (END)
// completed -> idle (RESET)
// idle -> active (RECOVER -- special case, restores from snapshot)

function runReducer(state: RunSessionState, action: RunAction): RunSessionState {
  switch (action.type) {
    case 'START':
      if (state.status !== 'idle') return state; // Guard: only from idle
      return { status: 'active', runId: action.runId, ... };
    // ... other transitions with guards
  }
}
```

### Pattern 2: Side Effect Coordination in useEffect
**What:** Each side effect (GPS, timer, wake lock, snapshots) managed by a useEffect keyed on run state
**When to use:** When browser APIs need to start/stop based on state transitions
**Example:**
```typescript
// GPS watcher: active when status === 'active'
useEffect(() => {
  if (status !== 'active') return;
  const watchId = watchFilteredPosition(
    (pos) => { traceRef.current.push(pos); onPointAccepted(getSnapshot); },
    (pos, reason) => console.debug('GPS rejected:', reason),
    (err) => console.warn('GPS error:', err)
  );
  return () => clearWatch(watchId);
}, [status]);

// Timer: active when status === 'active'
useEffect(() => {
  if (status !== 'active') return;
  const interval = setInterval(() => {
    elapsedRef.current = Date.now() - startTimeRef.current - pausedDurationRef.current;
  }, 100); // 100ms update for smooth display
  return () => clearInterval(interval);
}, [status]);
```

### Pattern 3: Ref-Based Timer (No Drift)
**What:** Store startTime and pausedDuration in refs, compute elapsed on each tick
**When to use:** Accurate elapsed time that survives pause/resume cycles
**Example:**
```typescript
const startTimeRef = useRef(0);        // Date.now() when run started
const pausedDurationRef = useRef(0);   // Total ms spent paused
const pauseStartRef = useRef(0);       // Date.now() when current pause began

function pauseRun() {
  pauseStartRef.current = Date.now();
  dispatch({ type: 'PAUSE', elapsedMs: computeElapsed() });
}

function resumeRun() {
  pausedDurationRef.current += Date.now() - pauseStartRef.current;
  dispatch({ type: 'RESUME' });
}

function computeElapsed(): number {
  return Date.now() - startTimeRef.current - pausedDurationRef.current;
}
```

### Anti-Patterns to Avoid
- **Incrementing a counter each interval tick:** Drifts over time, wrong after tab suspension. Always compute elapsed from wall clock.
- **Starting GPS watcher before run starts:** Wastes battery and creates unnecessary position data.
- **Forgetting to cleanup on unmount:** GPS watcher, interval, wake lock, and snapshot schedule all need cleanup in useEffect return functions.
- **Using useState for trace array:** Re-renders on every GPS point. Use `useRef` for the trace array, only trigger re-render when needed for UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Run ID generation | UUID implementation | `crypto.randomUUID()` | Built into all modern browsers |
| GPS filtering | Custom accuracy/jitter logic | `watchFilteredPosition` from Phase 1 | Already implemented and tested |
| Crash recovery persistence | Custom snapshot logic | `startSnapshotSchedule`/`onPointAccepted` from Phase 1 | Already handles 10s timer + 30-point threshold |
| Wake lock management | Direct API calls | `acquireWakeLock`/`releaseWakeLock` from Phase 1 | Already handles re-acquisition on visibility change |
| Distance calculation | Custom haversine | Accumulate from GPS filter trace | Sum segment distances from consecutive FilteredPosition points |

**Key insight:** This phase is 100% integration work. All the hard infrastructure was built in Phase 1. The value is in correct state coordination, not in building new primitives.

## Common Pitfalls

### Pitfall 1: Timer Drift After Tab Suspension
**What goes wrong:** iOS Safari suspends timers when the tab is backgrounded. An interval-based counter will show wrong elapsed time.
**Why it happens:** `setInterval` callbacks are paused when the browser suspends JavaScript execution.
**How to avoid:** Never increment a counter. Always compute elapsed as `Date.now() - startTime - pausedDuration`. The wall clock keeps ticking even when JS is suspended.
**Warning signs:** Timer jumps forward or freezes when switching back to the app.

### Pitfall 2: GPS Watcher Leak on State Transition
**What goes wrong:** Starting a new GPS watcher on resume without clearing the paused one creates duplicate watchers, double-counting positions.
**Why it happens:** useEffect cleanup runs on dependency change, but if the watcher ID is managed outside the effect, cleanup may be missed.
**How to avoid:** Let useEffect manage the GPS watcher lifecycle: start in the effect body, clear in the cleanup function. Key the effect on `status` so it naturally starts/stops.
**Warning signs:** Position callbacks fire twice, trace grows twice as fast.

### Pitfall 3: Crash Recovery Race with Route Generation
**What goes wrong:** User opens app, crash recovery modal appears, but simultaneously a route generation or other async operation starts.
**Why it happens:** Multiple useEffects run on mount independently.
**How to avoid:** Check for incomplete runs FIRST, before any other initialization. If a recovery is found, set a flag that prevents other flows until the user decides (resume or discard).
**Warning signs:** Modal appears briefly then disappears, or route replaces recovered state.

### Pitfall 4: Stale Closure in Snapshot Getter
**What goes wrong:** The `getRunState` function passed to `startSnapshotSchedule` captures stale trace/elapsed values.
**Why it happens:** JavaScript closures capture variable references at creation time.
**How to avoid:** Use refs for mutable data (trace, elapsed). The getter function reads from refs, which always reflect current values.
**Warning signs:** Snapshots always show 0 distance or empty trace.

### Pitfall 5: Wake Lock on Pause
**What goes wrong:** Keeping wake lock during pause drains battery unnecessarily.
**Why it happens:** Not releasing wake lock on pause transition.
**How to avoid:** Release wake lock on pause, re-acquire on resume. The existing `setupVisibilityReacquire` handles tab-switch re-acquisition.
**Warning signs:** Battery drain when run is paused for extended periods.

## Code Examples

### useRunSession Hook Return Type
```typescript
interface UseRunSessionReturn {
  status: RunState;
  elapsedMs: number;
  distanceMeters: number;
  trace: FilteredPosition[];
  startRun: (routeId: string | null) => void;
  pauseRun: () => void;
  resumeRun: () => void;
  endRun: () => Promise<CompletedRun>;
  recoverRun: (snapshot: ActiveRunSnapshot) => void;
  reset: () => void;
}
```

### Distance Accumulation from GPS Trace
```typescript
function computeDistance(trace: FilteredPosition[]): number {
  let total = 0;
  for (let i = 1; i < trace.length; i++) {
    total += haversineMeters(
      trace[i - 1].lat, trace[i - 1].lng,
      trace[i].lat, trace[i].lng
    );
  }
  return total;
}
```

### Crash Recovery Check on Mount
```typescript
// In page.tsx
useEffect(() => {
  async function checkCrashRecovery() {
    const incomplete = await findIncompleteRun();
    if (incomplete) {
      setRecoverySnapshot(incomplete);
      setShowRecoveryDialog(true);
    }
  }
  checkCrashRecovery();
}, []);
```

### End Run Dialog Pattern
```typescript
// Simple modal -- no library needed
function EndRunDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full">
        <h2 className="text-white text-xl font-bold">End Run?</h2>
        <p className="text-gray-400 mt-2">Your run will be saved to history.</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 ...">Keep Going</button>
          <button onClick={onConfirm} className="flex-1 ...">End Run</button>
        </div>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External state machine libs (XState) | useReducer for simple FSMs | React 16.8+ (2019) | Zero dependency, same guarantees for <10 states |
| setInterval counter for elapsed time | Wall clock computation (Date.now() - start) | Best practice | Accurate after tab suspension, no drift |
| localStorage for crash recovery | IndexedDB snapshots | Phase 1 (this project) | Handles large traces, survives iOS eviction with persist() |

**Deprecated/outdated:**
- Nothing relevant -- all patterns used here are current React 19 idioms

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | State machine transitions: only valid transitions accepted, invalid ones rejected | unit | `npx vitest run src/hooks/__tests__/useRunSession.test.ts -x` | No -- Wave 0 |
| RUN-02 | Pause stops timer/GPS, resume restarts them correctly | unit | `npx vitest run src/hooks/__tests__/useRunSession.test.ts -x` | No -- Wave 0 |
| RUN-03 | End run produces CompletedRun with correct fields | unit | `npx vitest run src/hooks/__tests__/useRunSession.test.ts -x` | No -- Wave 0 |
| RUN-04 | Recovery restores snapshot into active state | unit | `npx vitest run src/hooks/__tests__/useRunSession.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useRunSession.test.ts` -- covers RUN-01, RUN-02, RUN-03, RUN-04 (state machine logic)
- [ ] Test strategy: Extract pure reducer and helper functions for unit testing without DOM/React rendering. The reducer's transition guards are the core correctness guarantee.

## Open Questions

1. **Timer update interval for UI display**
   - What we know: 100ms gives smooth display, 1000ms saves CPU
   - What's unclear: What feels right on mobile during a run
   - Recommendation: Start with 100ms (smooth elapsed time display), can throttle later if battery is a concern. This is Claude's discretion per CONTEXT.md.

2. **Recovery + simultaneous route state**
   - What we know: Recovery dialog should block other interactions
   - What's unclear: Whether to restore the original route on recovery
   - Recommendation: On recovery, restore the run but show "no route" -- the user was mid-run so the trace is what matters. Route data is not in ActiveRunSnapshot. This is Claude's discretion per CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- Project source code: `src/lib/crash-recovery.ts`, `src/lib/gps-filter.ts`, `src/lib/wake-lock.ts`, `src/lib/db.ts`
- Project types: `src/types/index.ts` -- ActiveRunSnapshot, CompletedRun, FilteredPosition
- Project CONTEXT.md: Locked decisions for state machine architecture and UI

### Secondary (MEDIUM confidence)
- React useReducer patterns -- standard React documentation pattern for FSMs

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all Phase 1 modules verified in source
- Architecture: HIGH -- useReducer + useEffect pattern is well-established React idiom, existing codebase follows hook isolation pattern
- Pitfalls: HIGH -- timer drift, GPS watcher leaks, stale closures are well-documented React + browser API issues

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no fast-moving dependencies)
