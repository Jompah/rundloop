# Phase 1: Storage & GPS Foundation - Research

**Researched:** 2026-03-19
**Domain:** IndexedDB persistence, GPS position filtering, Wake Lock API, crash recovery
**Confidence:** HIGH

## Summary

Phase 1 replaces the existing localStorage persistence layer with IndexedDB, implements a GPS filtering pipeline that sits between `navigator.geolocation.watchPosition` and all consumers, integrates the Wake Lock API for screen-on during navigation, and adds periodic run state snapshots for crash recovery. This is pure infrastructure -- no UI changes, no new screens.

The existing codebase has a clean localStorage wrapper in `src/lib/storage.ts` with SSR guards, a GPS wrapper in `src/lib/geolocation.ts` with fake GPS testing mode, and TypeScript interfaces in `src/types/index.ts`. The migration path is clear: build the new IndexedDB layer, update exports to match existing signatures, migrate data on first load, then remove localStorage code.

**Primary recommendation:** Use raw IndexedDB API (not idb-keyval) for all three stores to keep a single database connection and simplify version management. The `idb` wrapper (8.0.3, 1.2KB) is a better fit than `idb-keyval` (which lacks cursor/index support needed for runs store). GPS filtering uses simple threshold functions (no Kalman filter per CONTEXT.md decisions).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Reject GPS positions with accuracy > 30m (standard for urban running)
- Reject positions implying speed > 45 km/h (teleport detection)
- Require minimum 3m distance delta between accepted points (filters jitter while capturing turns)
- Use simple threshold filtering first; defer Kalman filtering unless real-device testing reveals inadequacy
- Filter pipeline sits between navigator.geolocation and consumers -- existing `watchPosition` wrapper in geolocation.ts is the integration point
- Three separate object stores: `runs` (completed + active), `routes` (saved favorites), `settings`
- Runs store keyed by ID, indexed by startTime for chronological queries
- One-time migration from localStorage on first load: read existing SavedRoute[] and AppSettings, write to IndexedDB, then clear localStorage keys
- GPS traces stored as arrays of filtered points with: lat, lng, accuracy, timestamp, speed
- Snapshot active run to IndexedDB every 30 accepted GPS points OR every 10 seconds, whichever comes first
- Snapshot includes: full GPS trace so far, cumulative elapsed time, pause state, route reference ID
- On app relaunch, check for incomplete run record (has startTime but no endTime)
- Show recovery modal with two options: "Resume Run" or "Discard"
- Acquire Wake Lock on run start, release on run end or completion
- Re-acquire after pause -> resume transition
- If Wake Lock API unavailable (older iOS), show warning banner
- Handle Wake Lock release on page visibility change -- re-acquire when page becomes visible again

### Claude's Discretion
- Exact IndexedDB version numbering and upgrade handling
- idb-keyval vs raw IDB boundary -- can use raw IDB for everything if simpler
- Internal GPS filter function signature and module organization
- Whether to create a new `src/lib/db.ts` or extend `src/lib/storage.ts`
- Snapshot timer implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GPS-01 | GPS positions are filtered for accuracy (reject low-accuracy readings, minimum distance delta, teleport detection) | GPS filtering pipeline pattern with `shouldAcceptPosition()` function; thresholds locked at 30m accuracy, 3m min delta, 45 km/h max speed |
| GPS-02 | GPS tracking survives brief network drops without crashing or losing position data | IndexedDB crash recovery snapshots every 30 points / 10 seconds; `watchPosition` error handler with graceful degradation |
| GPS-03 | Wake Lock API keeps screen on during active navigation | Wake Lock API pattern with `visibilitychange` re-acquisition; iOS 16.4+ support, PWA bug fixed in iOS 18.4 |
| GPS-04 | Run state is periodically snapshot to IndexedDB for crash recovery | Snapshot pattern with dual trigger (point count + timer); incomplete run detection on app launch |
| STOR-01 | Run history persisted to IndexedDB with full GPS traces | `runs` object store with `id` keyPath and `startTime` index; GPS trace as array within run record |
| STOR-02 | Saved/favorite routes persisted to IndexedDB | `routes` object store migrated from localStorage `SavedRoute[]` format |
| STOR-03 | Storage persistence requested via navigator.storage.persist() | Call on app launch; handle denial gracefully; iOS Safari 17+ supports the API |
| STOR-04 | Settings and user preferences persisted to IndexedDB | `settings` object store with simple key-value pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Raw IndexedDB API | Browser native | All data persistence (runs, routes, settings) | Needed for indexes and cursors on runs store; avoids multiple abstractions; single DB connection |
| Navigator Geolocation API | Browser native | GPS position tracking | Already integrated via `geolocation.ts`; no wrapper needed |
| Screen Wake Lock API | Browser native | Keep screen on during navigation | iOS 16.4+, PWA standalone fixed in iOS 18.4 |
| Storage API (persist) | Browser native | Prevent iOS 7-day eviction | `navigator.storage.persist()` on launch |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | Phase 1 uses only browser native APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw IndexedDB | idb-keyval 6.2.2 | Simpler API but no cursor/index support -- needed for runs store `startTime` index |
| Raw IndexedDB | idb 8.0.3 | Thin promise wrapper, 1.2KB -- reasonable choice but adds a dependency for minimal gain in this phase |
| Raw IndexedDB | Dexie.js 4.x | Full query engine, ~25KB -- overkill for 3 simple stores |

**Recommendation on Claude's Discretion (idb-keyval vs raw IDB):** Use raw IndexedDB for everything. The three stores share one database and one version. idb-keyval creates its own separate database with a fixed store name, which would mean managing two IndexedDB databases. Raw IDB with a promise wrapper utility (20 lines) is simpler overall.

**Installation:**
```bash
# No new npm packages needed for Phase 1
# All APIs are browser-native
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    db.ts              # IndexedDB connection, schema, migration (NEW)
    gps-filter.ts      # GPS filtering pipeline (NEW)
    wake-lock.ts       # Wake Lock manager (NEW)
    geolocation.ts     # MODIFIED: integrate filter pipeline
    storage.ts         # MODIFIED: delegate to db.ts, keep export signatures
  types/
    index.ts           # MODIFIED: add Run, FilteredPosition types
```

### Pattern 1: Promise-Wrapped IndexedDB
**What:** Wrap IndexedDB request/transaction callbacks in Promises for async/await usage.
**When to use:** All IndexedDB operations.
**Example:**
```typescript
// Source: MDN IndexedDB API / standard pattern
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rundloop', 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('runs')) {
        const runStore = db.createObjectStore('runs', { keyPath: 'id' });
        runStore.createIndex('startTime', 'startTime', { unique: false });
      }
      if (!db.objectStoreNames.contains('routes')) {
        db.createObjectStore('routes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Generic helper for single-record operations
function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  });
}

function dbPut<T>(storeName: string, value: T): Promise<void> {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}
```

### Pattern 2: GPS Filter Pipeline
**What:** Pure function that decides whether to accept or reject a GPS position based on accuracy, distance delta, and speed.
**When to use:** Every raw GPS position before any consumer sees it.
**Example:**
```typescript
// Source: CONTEXT.md locked decisions + ARCHITECTURE.md pattern
export interface FilteredPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
}

export function shouldAcceptPosition(
  newPos: GeoPosition,
  lastAccepted: FilteredPosition | null
): boolean {
  // Accuracy gate: reject if GPS uncertainty > 30m
  if (newPos.accuracy > 30) return false;

  // First accepted point -- no previous to compare
  if (!lastAccepted) return true;

  // Distance delta
  const distance = haversineMeters(
    lastAccepted.lat, lastAccepted.lng,
    newPos.lat, newPos.lng
  );

  // Jitter gate: reject if moved < 3m (GPS noise)
  if (distance < 3) return false;

  // Teleport gate: reject if implied speed > 45 km/h (12.5 m/s)
  const timeDeltaSec = (newPos.timestamp - lastAccepted.timestamp) / 1000;
  if (timeDeltaSec > 0) {
    const speedMs = distance / timeDeltaSec;
    if (speedMs > 12.5) return false;
  }

  return true;
}
```

### Pattern 3: Wake Lock with Visibility Re-acquisition
**What:** Acquire Wake Lock on run start, release on end, re-acquire on visibility change.
**When to use:** During active navigation.
**Example:**
```typescript
// Source: MDN Screen Wake Lock API + web.dev blog
let wakeLock: WakeLockSentinel | null = null;

export async function acquireWakeLock(): Promise<boolean> {
  if (!('wakeLock' in navigator)) return false;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
    return true;
  } catch {
    return false;
  }
}

export function releaseWakeLock(): void {
  wakeLock?.release();
  wakeLock = null;
}

// Call this once on mount during active navigation
export function setupVisibilityReacquire(): () => void {
  const handler = async () => {
    if (document.visibilityState === 'visible' && !wakeLock) {
      await acquireWakeLock();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
```

### Pattern 4: localStorage Migration
**What:** One-time migration from localStorage to IndexedDB on first app load.
**When to use:** Once, on first load after Phase 1 deployment.
**Example:**
```typescript
const MIGRATION_KEY = 'rundloop_migrated_to_idb';

export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  // Migrate settings
  const settingsRaw = localStorage.getItem('rundloop_settings');
  if (settingsRaw) {
    try {
      const settings = JSON.parse(settingsRaw);
      await dbPut('settings', { key: 'app', ...settings });
    } catch { /* ignore corrupt data */ }
  }

  // Migrate saved routes
  const routesRaw = localStorage.getItem('rundloop_history');
  if (routesRaw) {
    try {
      const routes: SavedRoute[] = JSON.parse(routesRaw);
      for (const route of routes) {
        await dbPut('routes', route);
      }
    } catch { /* ignore corrupt data */ }
  }

  // Mark migration complete and clean up
  localStorage.setItem(MIGRATION_KEY, 'true');
  localStorage.removeItem('rundloop_settings');
  localStorage.removeItem('rundloop_history');
}
```

### Pattern 5: Crash Recovery Snapshot
**What:** Periodic snapshots of active run state to IndexedDB.
**When to use:** During active runs, triggered by point count or timer.
**Example:**
```typescript
let snapshotPointCount = 0;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;

export function startSnapshotSchedule(
  getRunState: () => ActiveRunSnapshot
): void {
  snapshotPointCount = 0;
  snapshotTimer = setInterval(() => {
    saveSnapshot(getRunState());
  }, 10_000); // Every 10 seconds
}

export function onPointAccepted(
  getRunState: () => ActiveRunSnapshot
): void {
  snapshotPointCount++;
  if (snapshotPointCount >= 30) {
    snapshotPointCount = 0;
    saveSnapshot(getRunState());
  }
}

async function saveSnapshot(snapshot: ActiveRunSnapshot): Promise<void> {
  await dbPut('runs', {
    ...snapshot,
    id: snapshot.id, // same ID overwrites previous snapshot
    // No endTime = incomplete run marker
  });
}

export async function findIncompleteRun(): Promise<ActiveRunSnapshot | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('runs', 'readonly');
    const store = tx.objectStore('runs');
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const result = cursor.result;
      if (!result) { resolve(null); return; }
      if (!result.value.endTime && result.value.startTime) {
        resolve(result.value);
        return;
      }
      result.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}
```

### Anti-Patterns to Avoid
- **Synchronous localStorage for GPS traces:** Blocks main thread, 5MB limit. Use IndexedDB.
- **Multiple IndexedDB databases:** idb-keyval creates its own DB. Keep everything in one `rundloop` database.
- **Not handling IndexedDB `onblocked`:** If another tab has the DB open at an old version, `onupgradeneeded` blocks. Add `onblocked` handler.
- **Storing raw (unfiltered) GPS positions:** Never let unfiltered positions reach any consumer. Filter at the source in `geolocation.ts`.
- **Assuming Wake Lock persists across visibility changes:** iOS releases it. Always re-acquire on `visibilitychange`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Haversine distance | Custom formula from scratch | Existing `haversineMeters()` in `storage.ts` | Already implemented and tested; extract to shared utility |
| IndexedDB promise wrappers | Full ORM/query builder | Small utility functions (20 lines) | Raw IDB is verbose but predictable; full wrappers add abstraction for no gain at this scale |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Already used in `storage.ts`; browser-native, cryptographically random |
| SSR safety checks | Custom detection | `typeof window === 'undefined'` pattern | Already established in codebase |

**Key insight:** Phase 1 uses only browser-native APIs. The complexity is in correct integration (visibility handling, migration, snapshot scheduling), not in library selection.

## Common Pitfalls

### Pitfall 1: iOS Safari Evicts Storage After 7 Days of Inactivity
**What goes wrong:** Weekend runners lose all data because iOS ITP deletes IndexedDB after 7 days without user interaction.
**Why it happens:** Apple's Intelligent Tracking Prevention treats all script-writable storage as expendable.
**How to avoid:** Call `navigator.storage.persist()` on every app launch. If denied, show a warning that data may be lost. Design all reads to handle empty/missing data gracefully.
**Warning signs:** Users reporting lost run history, empty app after a week away.

### Pitfall 2: Wake Lock Released When App Backgrounds
**What goes wrong:** Runner checks a notification, Wake Lock is released, screen auto-locks, GPS stops.
**Why it happens:** The Wake Lock API spec requires release when visibility changes. iOS is aggressive about this.
**How to avoid:** Listen to `visibilitychange` event and re-acquire when `document.visibilityState === 'visible'`. The pattern is in the code examples above.
**Warning signs:** Screen locking during runs after briefly switching apps.

### Pitfall 3: IndexedDB `onblocked` When Multiple Tabs Open
**What goes wrong:** Database upgrade hangs because another tab holds an old version connection.
**Why it happens:** IndexedDB version upgrades require exclusive access. If another tab has the DB open, `onupgradeneeded` blocks until that connection closes.
**How to avoid:** Add `onblocked` handler to the open request. In the `onversionchange` handler of existing connections, close the database immediately: `db.onversionchange = () => db.close()`.
**Warning signs:** App hangs on launch with no error.

### Pitfall 4: GPS Filter Rejecting All Points on Cold Start
**What goes wrong:** First few GPS readings have accuracy > 30m (cold GPS fix). All are rejected. User sees no position for 10-30 seconds.
**Why it happens:** GPS needs time to acquire satellite lock. Cold starts typically produce 50-100m accuracy initially.
**How to avoid:** Use a "warming up" state where the first accepted position has a relaxed accuracy threshold (e.g., 50m). Once a position with accuracy < 30m is received, switch to strict mode. Display "Acquiring GPS..." to the user during warmup.
**Warning signs:** Long delay before user dot appears on map.

### Pitfall 5: Snapshot Writes During IndexedDB Transaction Conflicts
**What goes wrong:** A snapshot write conflicts with a concurrent read (e.g., checking for incomplete runs), causing one transaction to fail silently.
**Why it happens:** IndexedDB transactions auto-commit when they become inactive. Overlapping readwrite transactions on the same store can conflict.
**How to avoid:** Use a single shared database connection (singleton pattern). Queue writes if needed. Keep transactions short -- don't do async work inside a transaction callback.
**Warning signs:** Sporadic "TransactionInactiveError" in console.

### Pitfall 6: Migration Race Condition on First Load
**What goes wrong:** Multiple components call `getSettings()` or `getSavedRoutes()` before migration completes, reading from empty IndexedDB instead of localStorage.
**Why it happens:** Migration is async (IndexedDB), but existing code is synchronous (localStorage). Components mount and read before migration finishes.
**How to avoid:** Gate app rendering behind migration completion. Use a loading state (`<MigrationGate>` wrapper) that runs migration once, then renders children. Expose a `ready` promise from `db.ts`.
**Warning signs:** Settings/routes appear empty briefly on first load after upgrade.

## Code Examples

### IndexedDB Schema Setup
```typescript
// Source: MDN Using IndexedDB
const DB_NAME = 'rundloop';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Runs store: keyed by id, indexed by startTime
      if (!db.objectStoreNames.contains('runs')) {
        const runStore = db.createObjectStore('runs', { keyPath: 'id' });
        runStore.createIndex('startTime', 'startTime', { unique: false });
      }

      // Routes store: keyed by id
      if (!db.objectStoreNames.contains('routes')) {
        db.createObjectStore('routes', { keyPath: 'id' });
      }

      // Settings store: keyed by key name
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      // Handle version changes from other tabs
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);

    request.onblocked = () => {
      console.warn('IndexedDB upgrade blocked by another tab');
    };
  });
}
```

### Filtered GPS Watch
```typescript
// Source: existing geolocation.ts pattern + CONTEXT.md filter decisions
export function watchFilteredPosition(
  onAccepted: (pos: FilteredPosition) => void,
  onRejected: (pos: GeoPosition, reason: string) => void,
  onError: (err: GeolocationPositionError) => void
): number {
  let lastAccepted: FilteredPosition | null = null;

  return watchPosition(
    (pos: GeoPosition) => {
      if (pos.accuracy > 30) {
        onRejected(pos, 'accuracy');
        return;
      }

      if (lastAccepted) {
        const distance = haversineMeters(
          lastAccepted.lat, lastAccepted.lng,
          pos.lat, pos.lng
        );

        if (distance < 3) {
          onRejected(pos, 'jitter');
          return;
        }

        const timeDelta = (pos.timestamp - lastAccepted.timestamp) / 1000;
        if (timeDelta > 0 && (distance / timeDelta) > 12.5) {
          onRejected(pos, 'teleport');
          return;
        }
      }

      const filtered: FilteredPosition = {
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        timestamp: pos.timestamp,
        speed: pos.speed,
      };
      lastAccepted = filtered;
      onAccepted(filtered);
    },
    onError
  );
}
```

### Storage Persistence Request
```typescript
// Source: MDN Storage API
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!navigator.storage?.persist) return false;

  try {
    const persisted = await navigator.storage.persisted();
    if (persisted) return true;

    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for all data | IndexedDB for structured data | Established pattern | Removes 5MB limit, enables async, supports structured queries |
| idb-keyval for simple KV | Raw IDB or `idb` for indexed stores | Current best practice | idb-keyval lacks index/cursor support |
| No GPS filtering | Threshold-based filtering pipeline | Standard in native running apps | Eliminates phantom distance, stabilizes metrics |
| No crash recovery | Periodic IndexedDB snapshots | Standard in running apps | Prevents data loss on iOS tab kill |
| No Wake Lock | Wake Lock API with visibility re-acquire | iOS 16.4+ (2023), PWA fix iOS 18.4 (2025) | Screen stays on during runs |

**Deprecated/outdated:**
- `localForage`: Last release 2021, unmaintained. Do not use.
- `localStorage` for anything beyond simple flags: 5MB limit, synchronous, blocks main thread.

## Open Questions

1. **navigator.storage.persist() actual behavior on iOS Safari**
   - What we know: The API exists on iOS Safari 17+. Safari may auto-grant or auto-deny without user prompt.
   - What's unclear: Whether iOS truly respects the persistence flag or still evicts under memory pressure. Multiple sources suggest iOS does not provide true persistence guarantees.
   - Recommendation: Call it anyway (no harm), but design as if data can be evicted at any time. Display storage status to user.

2. **GPS cold start accuracy relaxation threshold**
   - What we know: First GPS readings often have accuracy > 30m. Rejecting all of them means no position for 10-30 seconds.
   - What's unclear: Exact threshold and duration for warmup phase.
   - Recommendation: Accept first position at accuracy < 50m, switch to strict 30m after first good fix. This is an implementation detail within Claude's discretion.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 (not yet installed) |
| Config file | None -- Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GPS-01 | GPS positions filtered by accuracy, distance, speed | unit | `npx vitest run src/lib/__tests__/gps-filter.test.ts` | Wave 0 |
| GPS-02 | GPS tracking handles errors without crash | unit | `npx vitest run src/lib/__tests__/gps-filter.test.ts` | Wave 0 |
| GPS-03 | Wake Lock acquired/released correctly | unit | `npx vitest run src/lib/__tests__/wake-lock.test.ts` | Wave 0 |
| GPS-04 | Run state snapshots to IndexedDB periodically | unit | `npx vitest run src/lib/__tests__/db.test.ts` | Wave 0 |
| STOR-01 | Run history CRUD in IndexedDB | unit | `npx vitest run src/lib/__tests__/db.test.ts` | Wave 0 |
| STOR-02 | Saved routes CRUD in IndexedDB | unit | `npx vitest run src/lib/__tests__/db.test.ts` | Wave 0 |
| STOR-03 | Storage persistence requested on launch | unit | `npx vitest run src/lib/__tests__/db.test.ts` | Wave 0 |
| STOR-04 | Settings CRUD in IndexedDB | unit | `npx vitest run src/lib/__tests__/db.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Install vitest: `npm install -D vitest`
- [ ] Install fake-indexeddb for Node.js testing: `npm install -D fake-indexeddb`
- [ ] `vitest.config.ts` -- basic config with path aliases matching tsconfig
- [ ] `src/lib/__tests__/gps-filter.test.ts` -- GPS filter unit tests
- [ ] `src/lib/__tests__/wake-lock.test.ts` -- Wake Lock manager tests (mock navigator.wakeLock)
- [ ] `src/lib/__tests__/db.test.ts` -- IndexedDB CRUD tests (using fake-indexeddb)

## Sources

### Primary (HIGH confidence)
- [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) - schema setup, transactions, cursors
- [MDN: Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) - acquire/release pattern, visibility re-acquisition
- [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) - persist() behavior, iOS eviction
- [Can I Use: Wake Lock API](https://caniuse.com/wake-lock) - iOS 16.4+ support, PWA fix in iOS 18.4
- [web.dev: Screen Wake Lock API](https://web.dev/blog/screen-wake-lock-supported-in-all-browsers) - visibility change re-acquisition pattern
- Existing codebase: `src/lib/storage.ts`, `src/lib/geolocation.ts`, `src/types/index.ts` - current patterns and interfaces

### Secondary (MEDIUM confidence)
- [WebKit Bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545) - Wake Lock in Home Screen Web Apps, fixed in iOS 18.4
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) - 7-day eviction policy details
- [PWA iOS Limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) - comprehensive iOS PWA limitations
- `.planning/research/ARCHITECTURE.md` - project architecture patterns and IndexedDB schema
- `.planning/research/PITFALLS.md` - iOS GPS and storage pitfalls
- `.planning/research/STACK.md` - idb-keyval recommendation (reconsidered -- raw IDB preferred)

### Tertiary (LOW confidence)
- [RxDB: Solving IndexedDB Slowness](https://rxdb.info/slow-indexeddb.html) - performance optimization (batched cursors, sharding)
- navigator.storage.persist() actual iOS behavior -- conflicting reports on whether iOS truly honors persistence

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - browser-native APIs with well-documented MDN references
- Architecture: HIGH - patterns verified against existing codebase and MDN documentation
- Pitfalls: HIGH - iOS-specific issues well-documented across multiple sources
- GPS filtering: HIGH - thresholds locked by user decisions, standard pattern in running apps
- Storage persistence on iOS: MEDIUM - API exists but actual iOS behavior has conflicting reports

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable browser APIs, no fast-moving dependencies)
