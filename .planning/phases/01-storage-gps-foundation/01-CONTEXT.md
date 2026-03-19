# Phase 1: Storage & GPS Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Reliable IndexedDB storage layer replacing localStorage, GPS position filtering pipeline rejecting noisy readings, Wake Lock API integration for screen-on during navigation, and periodic run state snapshots for crash recovery. This is pure infrastructure — no UI changes, no new screens.

</domain>

<decisions>
## Implementation Decisions

### GPS Filtering Thresholds
- Reject GPS positions with accuracy > 30m (standard for urban running)
- Reject positions implying speed > 45 km/h (teleport detection — faster than any runner)
- Require minimum 3m distance delta between accepted points (filters jitter while capturing turns)
- Use simple threshold filtering first; defer Kalman filtering unless real-device testing reveals inadequacy
- Filter pipeline sits between navigator.geolocation and consumers — existing `watchPosition` wrapper in geolocation.ts is the integration point

### IndexedDB Schema & Migration
- Three separate object stores: `runs` (completed + active), `routes` (saved favorites), `settings`
- Runs store keyed by ID, indexed by startTime for chronological queries
- One-time migration from localStorage on first load: read existing SavedRoute[] and AppSettings, write to IndexedDB, then clear localStorage keys
- Use idb-keyval for settings (simple key-value), raw IndexedDB API for runs and routes (need cursors and indexes)
- GPS traces stored as arrays of filtered points with: lat, lng, accuracy, timestamp, speed

### Crash Recovery Strategy
- Snapshot active run to IndexedDB every 30 accepted GPS points OR every 10 seconds, whichever comes first
- Snapshot includes: full GPS trace so far, cumulative elapsed time, pause state, route reference ID
- On app relaunch, check for incomplete run record (has startTime but no endTime)
- Show recovery modal with two options: "Resume Run" or "Discard"
- Resume restores GPS tracking from last snapshot position

### Wake Lock Behavior
- Acquire Wake Lock on run start, release on run end or completion
- Re-acquire after pause→resume transition
- If Wake Lock API unavailable (older iOS), show warning banner — no workaround, user keeps screen on manually
- Handle Wake Lock release on page visibility change (iOS may release it) — re-acquire when page becomes visible again

### Claude's Discretion
- Exact IndexedDB version numbering and upgrade handling
- idb-keyval vs raw IDB boundary — can use raw IDB for everything if simpler
- Internal GPS filter function signature and module organization
- Whether to create a new `src/lib/db.ts` or extend `src/lib/storage.ts`
- Snapshot timer implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing implementation
- `src/lib/storage.ts` — Current localStorage CRUD, SavedRoute type, findNearbySavedRoutes with Haversine
- `src/lib/geolocation.ts` — Current GPS wrapper, GeoPosition interface, fake GPS testing mode
- `src/types/index.ts` — All TypeScript interfaces (GeneratedRoute, SavedRoute, AppSettings, TurnInstruction)

### PRD
- `PRD.md` §3 (GPS Navigation During Run) — GPS tracking requirements, off-route detection, Wake Lock
- `PRD.md` §6 (Mobile-First PWA) — Service worker, offline support requirements
- `PRD.md` §8 (Run History) — IndexedDB persistence requirements

### Research
- `.planning/research/ARCHITECTURE.md` — Component boundaries, GPS filtering patterns, IndexedDB approach
- `.planning/research/PITFALLS.md` — iOS GPS limitations, storage eviction, battery drain strategies
- `.planning/research/STACK.md` — idb-keyval recommendation, @turf/* for geospatial

No external specs or ADRs — requirements fully captured in PRD and decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/storage.ts`: Type-safe localStorage wrapper with SSR guard, error handling, Haversine distance function — migration source and pattern reference
- `src/lib/geolocation.ts`: GPS wrapper with `watchPosition()`, `getCurrentPosition()`, fake GPS testing mode — filter pipeline hooks into this
- `src/types/index.ts`: GeoPosition, GeneratedRoute, SavedRoute, AppSettings interfaces — extend with Run types

### Established Patterns
- SSR safety: `typeof window === 'undefined'` checks before browser API access
- Error handling: callbacks for async operations (not just thrown errors)
- Type-safe serialization: JSON parse/stringify with type assertions and defaults
- Dynamic imports for browser-only modules

### Integration Points
- `storage.ts` exports consumed by: SettingsView, HistoryView, RouteGenerator, page.tsx
- `geolocation.ts` exports consumed by: NavigationView, page.tsx (for initial position)
- New IndexedDB layer must maintain same export signatures during migration (or update all consumers)
- Wake Lock integrates in NavigationView's run lifecycle

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing codebase patterns (TypeScript, async/await, SSR-safe).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-storage-gps-foundation*
*Context gathered: 2026-03-19*
