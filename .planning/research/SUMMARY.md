# Project Research Summary

**Project:** RundLoop — Running PWA with GPS Navigation
**Domain:** Mobile-first running PWA with loop route generation, live GPS navigation, and run tracking
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

RundLoop is a polish-phase project: the core loop route generation (AI + algorithmic), MapLibre map rendering, basic navigation, and Next.js/React app framework are already in place. The research task is to identify what is missing from a "real running app" and how to add it correctly. The consensus across all four research areas is clear: the largest gap is not features but infrastructure — the current architecture lacks a run session lifecycle, uses localStorage (which will fail at scale), applies no GPS filtering (making metrics unreliable), and has no service worker for offline resilience. These must be built before any feature polish is meaningful.

The recommended approach treats this milestone as a bottom-up infrastructure build followed by UI integration. The dependency chain is strict: IndexedDB storage and GPS filtering must come first, the RunSession state machine next, then live metrics UI and navigation polish, then post-run summary and history, and finally map visualization enhancements and service worker. The total new bundle impact from recommended libraries is approximately 22KB gzip (idb-keyval, Motion, tree-shaken Turf.js, web-haptics), which is acceptable for a PWA targeting sub-3-second loads.

The dominant risks are all iOS Safari PWA constraints: GPS tracking stops when the app is backgrounded, storage is silently evicted after 7 days of inactivity, Web Speech API requires an explicit audio context unlock before voice navigation works, and the OSRM public API is unsuitable for production beyond a handful of users. All six critical pitfalls are addressable with known patterns (Wake Lock, IndexedDB persistence, storage.persist(), speech unlock on user gesture, self-hosted or commercial OSRM, adaptive GPS polling), but they must be built in from the start — retrofitting them after the UX is wired up is significantly more expensive.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16.2, React 19, Tailwind 4, MapLibre 5.20, TypeScript 5) is fixed and sound. The research identified five additions for this milestone: **idb-keyval 6.2.2** replaces localStorage for run data (0.6KB, async, no size limit); **Motion 12.x** (formerly Framer Motion) enables gesture animations and layout transitions needed for Runkeeper-quality polish (~15KB gzip); **@turf/helpers + @turf/distance + @turf/along + @turf/nearest-point-on-line** (tree-shaken, ~5KB total) replace the existing manual haversine for off-route detection, GPS snap-to-route, and progress-along-route; a **manual service worker** (`public/sw.js`) follows the Next.js 16 official recommendation over Serwist for app shell caching; and **web-haptics** (MEDIUM confidence, ~1KB) provides iOS haptic feedback via a Safari 17.4+ undocumented workaround. GPX export requires no dependency — it is ~30 lines of XML string templating.

**Core technologies:**
- **idb-keyval 6.2.2:** IndexedDB storage — 573 bytes, async, replaces blocking localStorage for GPS traces
- **Motion 12.x:** Animation — only option supporting layout animations + gesture interactions for premium feel
- **@turf/* (tree-shaken):** Geospatial — off-route detection, snap-to-route, distance-along-line (replaces manual haversine)
- **Manual sw.js:** Service worker — Next.js 16 recommends hand-written SW; Serwist adds build complexity for limited gain
- **Wake Lock API:** Native browser API — keep screen on during runs; iOS 16.4+ supported, PWA bug fixed iOS 18.4
- **web-haptics:** Haptic feedback — MEDIUM confidence; uses undocumented WebKit trick; fallback is Web Audio click

### Expected Features

The research identified a clear gap between what is built and what users expect from a running app. The most critical missing piece is the live metrics overlay (pace, distance, elapsed time, remaining distance) — this is what every runner looks at constantly and is the most visible gap vs competitors.

**Must have (table stakes currently missing or incomplete):**
- **Live run metrics overlay** (rolling km pace, total distance, elapsed time, remaining distance) — the single most-checked screen during a run
- **Pause/resume run** — runners stop at traffic lights; without this the app is unusable
- **Run summary screen** — the reward moment; distance, time, average pace, GPS trace; must save or discard
- **Keep screen on (Wake Lock)** — trivial to implement; critical for usability; without it navigation is useless
- **Run history with IndexedDB persistence** — sorted list of completed runs; without history, each run is disposable

**Should have (differentiators that are partially built or high-impact):**
- **Elevation gradient route coloring** — visual "wow" that makes screenshots shareable; high impact, medium effort
- **Off-route detection** — makes voice navigation reliable; needs Turf nearest-point-on-line
- **Split times per km** — expected by intermediate runners; shown in run summary
- **Route shuffle explicit UX** — make regeneration delightful; the feature exists, the UX does not

**Defer to next milestone (v2+):**
- GPX export — valuable but not needed for personal-use phase
- Route sharing links — requires server-side storage
- Progress analytics / charts — needs sufficient run history data to be useful
- Personal records — needs run history accumulation
- Save/reuse favorite routes — lower urgency than live metrics

### Architecture Approach

The current architecture has a single god component (`page.tsx`) owning all state with no run session model, no structured metrics computation, and no GPS filtering. The recommended refactor introduces two React contexts: **RunSessionProvider** (owns the GPS subscription, runs the session state machine, computes metrics, persists to IndexedDB) and **MapController** (wraps the MapLibre instance imperatively). Five new library modules underpin these contexts: `gps-engine.ts` (filtering pipeline), `metrics.ts` (pure functions: pace, distance, splits), `navigation.ts` (step tracking, off-route detection), `run-storage.ts` (IndexedDB for completed runs), and `route-storage.ts` (IndexedDB for generated routes). Views (`GenerateView`, `PreRunView`, `ActiveRunView`, `RunSummaryView`, `HistoryView`) become thin consumers of these contexts. The session lifecycle is modeled as an explicit state machine (`idle -> active -> paused -> completed`) via a reducer, preventing impossible states.

**Major components:**
1. **RunSessionProvider** — GPS subscription lifecycle, state machine, metrics computation, IndexedDB persistence (crash recovery every 30s)
2. **GPS Engine (`gps-engine.ts`)** — filters raw positions (accuracy > 30m rejected, < 2m delta rejected, > 45 km/h rejected); emits clean GeoPosition events
3. **MetricsCalculator (`metrics.ts`)** — pure functions: rolling 30s pace, accumulated distance, elapsed time, per-km splits
4. **NavigationEngine (`navigation.ts`)** — current step from GPS vs. route instructions, off-route detection via Turf nearest-point-on-line
5. **RunStorage / RouteStorage** — IndexedDB wrappers via idb-keyval; replaces localStorage; handles migration
6. **MapController** — imperative MapLibre wrapper; exposes `fitToRoute()`, `updateUserPosition()`, `rotateToBearing()`; avoids React-MapLibre reconciliation flicker
7. **WakeLockManager** — acquires on run start, re-acquires on visibility change, releases on run end
8. **Service Worker (`public/sw.js`)** — app shell caching only; GPS cannot run in SW on iOS

### Critical Pitfalls

1. **iOS GPS suspension when app loses focus** — use Wake Lock to prevent screen-off; store run state to IndexedDB every 10-30 seconds for crash recovery; detect and handle GPS gaps (timestamp delta) rather than ignoring them; warn users before starting a run
2. **Raw GPS data makes metrics unusable** — reject positions with accuracy > 25-30m; apply rolling 30s pace window (never use coords.speed); snap displayed position to route polyline; test by leaving phone stationary 5 minutes (phantom distance should be < 10m)
3. **Web Speech API silent failures on iOS Safari** — unlock audio context with a silent utterance on first user gesture (Start Run button); listen for `voiceschanged` event before accessing voices; call `cancel()` then fresh `speak()` after any visibility change; keep utterances under 200 characters; test only on real iPhone in standalone PWA mode
4. **iOS storage eviction after 7 days of inactivity** — call `navigator.storage.persist()` on app launch; handle missing/empty IndexedDB gracefully on every load; design Phase 2 cloud sync as the permanent solution
5. **OSRM public demo API is not production-ready** — self-host OSRM with Sweden OSM extract (~$5-10/month VPS) or switch to Mapbox Directions (100k free/month); add circuit breaker (3 failures -> user-friendly error); cache routes aggressively; must be resolved before multi-user testing
6. **Map rendering drains battery during navigation** — set `map.setMaxFPS(30)` during navigation; update map position at most every 2-3 seconds (not every GPS tick); avoid continuous heading rotation animation; target < 15% battery per hour; validate with real 30-minute test runs

## Implications for Roadmap

Based on research, the architecture's dependency chain dictates a strict bottom-up build order. The run session state machine is the central integration point everything flows through — it cannot be built until the storage and GPS engine foundations exist. UI and visualization can proceed in parallel once the session provider works.

### Phase 1: Storage and GPS Foundation
**Rationale:** IndexedDB (idb-keyval) and GPS filtering are leaf dependencies with no prerequisites. Without them, all subsequent features are built on a broken foundation. This phase produces no visible UI change but makes everything else correct.
**Delivers:** `RunStorage`, `RouteStorage` (IndexedDB wrappers), `gps-engine.ts` (filtering pipeline), `metrics.ts` (pure functions), `WakeLockManager`, migration from localStorage
**Addresses:** All table stakes features that need reliable data persistence; sets up split times, run history, crash recovery
**Avoids:** Phantom distance from GPS noise (Pitfall 2), storage eviction loss (Pitfall 4), localStorage 5MB limit

### Phase 2: Run Session Lifecycle
**Rationale:** The RunSession state machine is the central integration point. Once it exists, the UI and navigation layers can be wired in. Nothing in Phase 3+ can be built without this.
**Delivers:** `RunSession` state machine + reducer, `RunSessionProvider` React context, GPS crash recovery (30s IndexedDB snapshots), pause/resume state, elapsed time computation
**Addresses:** Pause/resume run, end run with confirmation (table stakes); prevents lost-run scenarios
**Avoids:** iOS GPS suspension data loss (Pitfall 1), missing run lifecycle causing impossible UI states

### Phase 3: Live Metrics UI
**Rationale:** With the session provider in place, the most visible gap (no live metrics) can be closed. This is what makes the app feel like a real running app.
**Delivers:** `ActiveRunView` live metrics overlay (pace, distance, elapsed time, remaining distance), pause/resume/end controls, audio km milestones, navigation step integration
**Addresses:** Live pace display, live distance, elapsed time, audio milestones (all table stakes), remaining distance (differentiator)
**Avoids:** Instantaneous pace display anti-feature (use rolling 30s window), information overload (max 3 metrics), small touch targets during run (48px+ minimum)

### Phase 4: Post-Run and History
**Rationale:** The run lifecycle must complete with a summary and history. Without this, runs are ephemeral. Depends on Phase 2 (completed run data) and Phase 3 (metrics).
**Delivers:** `RunSummaryView` (stats, GPS trace, save/discard), `HistoryView` (IndexedDB-backed list), split times display
**Addresses:** Run summary, run history (table stakes), split times per km (differentiator)
**Avoids:** Storage eviction by requesting persist() in this phase's storage setup

### Phase 5: Navigation and Map Polish
**Rationale:** With the core run loop working, navigation quality and visual polish become the differentiators. Off-route detection requires Turf and depends on an active run session existing.
**Delivers:** Off-route detection (Turf `nearestPointOnLine`), voice alert re-routing, map heading rotation, route gradient visualization (elevation colors via MapLibre `line-gradient`), GPS trace overlay during run
**Addresses:** Off-route detection, elevation gradient, full route preview (differentiators); turn-by-turn voice reliability
**Avoids:** False off-route alerts (require 3 consecutive positions, suppress when accuracy > 30m), MapLibre re-render flicker (update source data, not recreate layers), battery drain (map max 30fps)

### Phase 6: PWA and Infrastructure
**Rationale:** Service worker, OSRM production migration, and animation polish. These have no upstream feature dependencies and can be scoped to a hardening milestone. OSRM must be resolved before any multi-user testing.
**Delivers:** Manual service worker (app shell caching), OSRM self-hosted or Mapbox migration, Motion animations for view transitions, route shuffle explicit UX
**Addresses:** Offline resilience, production routing reliability, Runkeeper-quality UI polish
**Avoids:** OSRM public API failure at scale (Pitfall 5), cold-load perceived performance

### Phase Ordering Rationale

- **Storage before session:** You cannot persist a run session without a working storage layer. Build the foundation first even though it produces no visible output.
- **Session before UI:** The state machine is the API contract that all views program against. Defining it first prevents UI components from duplicating state.
- **Metrics before post-run:** You cannot show a run summary without a complete metrics computation pipeline tested live.
- **Navigation polish after core loop:** Off-route detection and map rotation are delighters, not foundations. A working-but-rough navigation is more valuable than a polished navigation that loses data.
- **PWA/infrastructure last:** Service worker can be retrofitted without architecture changes. OSRM migration is operational work that does not affect the React component tree.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Navigation and Map Polish):** Elevation data sourcing for gradient visualization is unresolved. OSRM's route response includes elevation if the OSM data has it, but the public API may not. The Open-Elevation API is an alternative (free, OSS). Research needed when planning this phase.
- **Phase 6 (OSRM migration):** Self-hosting OSRM with the foot profile for a Sweden OSM extract requires infrastructure setup. Mapbox Directions is a simpler alternative but has per-request costs at scale. Decision needs cost modeling.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Storage/GPS):** idb-keyval and Geolocation API are well-documented. GPS filtering patterns are well-established. No research needed.
- **Phase 2 (Run Session):** useReducer state machine is a standard React pattern. No research needed.
- **Phase 3 (Live Metrics):** Rolling window pace and timer implementation are straightforward. No research needed.
- **Phase 4 (History):** IndexedDB pagination is well-documented. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended libraries verified against official docs and npm. Version numbers confirmed. Bundle impacts measured. iOS compatibility matrix verified against caniuse.com and WebKit bugs. |
| Features | HIGH | Competitive analysis against Strava, NRC, Runkeeper with cited sources. Feature priorities grounded in what running apps actually ship, not speculation. |
| Architecture | HIGH | Patterns derived from first-principles analysis of the existing codebase + well-documented MDN/web.dev sources. State machine, GPS filtering, and IndexedDB patterns have broad documentation. |
| Pitfalls | HIGH | All six critical pitfalls are documented from official sources (WebKit bugs, Apple developer forums, OSRM usage policy). Reproduction steps provided. iOS-specific behaviors verified against real device reports. |

**Overall confidence:** HIGH

### Gaps to Address

- **Elevation data for gradient visualization:** OSRM's foot routing may or may not return elevation data depending on the OSM data quality for the region. The Open-Elevation API is an alternative but adds a dependency. Verify during Phase 5 planning whether OSRM's response includes `nodes[].elevation` for Swedish OSM data.
- **web-haptics stability:** MEDIUM confidence only. The `<input switch>` haptic trick is undocumented WebKit behavior. Monitor Apple developer changelog. If removed in an iOS update, fall back to short Web Audio click sound. Low risk — haptics are an enhancement, not a core feature.
- **Motion 12.x import path:** The library was rebranded from `framer-motion` to `motion`. Import from `motion/react`, not `framer-motion`. Verify build output does not include both packages if any dependencies still reference `framer-motion`.
- **Kalman filter for GPS:** PITFALLS.md recommends `kalmanjs` for GPS noise reduction beyond the simple accuracy/speed rejection filter. STACK.md does not include it. The simpler filtering (accuracy threshold + speed check) may be sufficient for MVP. Validate during Phase 1 implementation with real device testing before deciding whether to add kalmanjs.

## Sources

### Primary (HIGH confidence)
- [Next.js PWA Guide (official, v16.2.0)](https://nextjs.org/docs/app/guides/progressive-web-apps) — service worker approach
- [MDN: Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — Wake Lock patterns
- [MDN: Offline and background operation for PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — offline architecture
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) — 7-day storage eviction
- [WebKit Bug 254545: Wake Lock in Home Screen Web Apps](https://bugs.webkit.org/show_bug.cgi?id=254545) — iOS 18.4 fix confirmed
- [OSRM API Usage Policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy) — public API not for production
- [Can I Use: Wake Lock API](https://caniuse.com/wake-lock) — iOS 16.4+ confirmed
- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/) — rendering, gradients, performance
- [idb-keyval npm](https://www.npmjs.com/package/idb-keyval) — v6.2.2 confirmed
- [Motion (formerly Framer Motion)](https://motion.dev/) — v12.x import paths

### Secondary (MEDIUM confidence)
- [PWA iOS Limitations and Safari Support 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS PWA constraint overview
- [The State of Speech Synthesis in Safari](https://weboutloud.io/bulletin/speech_synthesis_in_safari/) — iOS SpeechSynthesis quirks
- [MapLibre Performance (GitHub Issue #96)](https://github.com/maplibre/maplibre-gl-js/issues/96) — GPU re-render issues
- [Strava vs Nike Run Club feature comparison](https://vernekard.medium.com/strava-vs-nike-run-club-whats-the-best-running-app-a96fcc61bb94) — competitive feature analysis
- [Running Apps UX Research](https://fernandocomet.medium.com/running-apps-ux-research-7e07e41f556c) — UX patterns
- [web-haptics GitHub](https://github.com/lochie/web-haptics) — iOS haptic workaround

### Tertiary (LOW confidence)
- [web-haptics package](https://github.com/lochie/web-haptics) — uses undocumented WebKit behavior; may break on iOS update

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
