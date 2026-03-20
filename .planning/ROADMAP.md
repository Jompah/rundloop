# Roadmap: RundLoop

## Overview

RundLoop has a working MVP with route generation and basic navigation. This milestone transforms it from a prototype into a polished running app that rivals Runkeeper in feel and reliability. The build order follows a strict dependency chain: reliable data infrastructure first (storage, GPS filtering), then the run session state machine that everything programs against, then the live experience layers (metrics, navigation, summary), then data browsing (history, saved routes), and finally visual and PWA polish. Each phase delivers a complete, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Storage & GPS Foundation** - IndexedDB storage layer and GPS filtering pipeline replace unreliable localStorage and raw GPS (completed 2026-03-20)
- [x] **Phase 2: Run Session Lifecycle** - State machine governs run states (idle/active/paused/completed) with crash recovery (completed 2026-03-20)
- [ ] **Phase 3: Live Run Metrics** - Real-time pace, distance, time, and remaining distance overlay during active runs
- [ ] **Phase 4: Navigation Polish** - Map auto-rotation, off-route detection, voice reliability, and milestone cues
- [ ] **Phase 5: Run Summary** - Post-run reward screen with stats, GPS trace overlay, and save/discard
- [ ] **Phase 6: Run History & Saved Routes** - Browse past runs and save/reuse favorite routes from IndexedDB
- [ ] **Phase 7: Route Visualization** - Beautiful route rendering with elevation gradients, turn indicators, and dark-mode colors
- [ ] **Phase 8: UI/UX & PWA Polish** - Premium design system, animations, haptics, service worker, and offline shell

## Phase Details

### Phase 1: Storage & GPS Foundation
**Goal**: All app data persists reliably in IndexedDB and GPS positions are filtered for accuracy before any consumer sees them
**Depends on**: Nothing (first phase)
**Requirements**: GPS-01, GPS-02, GPS-03, GPS-04, STOR-01, STOR-02, STOR-03, STOR-04
**Success Criteria** (what must be TRUE):
  1. Run data, routes, and settings persist across app restarts using IndexedDB (localStorage fully replaced)
  2. GPS positions with accuracy worse than 30m are rejected and never reach metrics or map display
  3. Teleporting GPS readings (speed > 45 km/h) are rejected
  4. Screen stays on during active navigation via Wake Lock API
  5. Storage persistence is requested on app launch to prevent iOS 7-day eviction
**Plans**: 5 plans

Plans:
- [ ] 01-00-PLAN.md — Test infrastructure (vitest, fake-indexeddb, test stubs)
- [ ] 01-01-PLAN.md — IndexedDB layer, types, migration, storage persistence
- [ ] 01-02-PLAN.md — GPS filter pipeline and Wake Lock manager
- [ ] 01-03-PLAN.md — Crash recovery snapshots and GPS error resilience
- [x] 01-04-PLAN.md — Gap closure: wire initDB() on app mount, document GPS filter Phase 2 dependency (completed 2026-03-20)

### Phase 2: Run Session Lifecycle
**Goal**: Users can start, pause, resume, and end runs with impossible states prevented and crash recovery built in
**Depends on**: Phase 1
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04
**Success Criteria** (what must be TRUE):
  1. Run progresses through idle -> active -> paused -> completed states with no way to reach invalid states
  2. User can pause a run and resume it with timer and GPS tracking pausing/resuming correctly
  3. User can end a run and sees a confirmation dialog before the run is finalized
  4. If the app crashes or is killed during a run, relaunch detects the interrupted run and offers recovery or discard
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — useRunSession hook with reducer state machine, side effects, and unit tests
- [ ] 02-02-PLAN.md — UI dialogs, NavigationView controls, page.tsx wiring with crash recovery

### Phase 3: Live Run Metrics
**Goal**: Runners see accurate, glanceable live stats during their run — the single most important screen in a running app
**Depends on**: Phase 2
**Requirements**: METR-01, METR-02, METR-03, METR-04, METR-05
**Success Criteria** (what must be TRUE):
  1. Current pace is displayed as a rolling lap average (not volatile instantaneous GPS speed)
  2. Total distance covered updates in real-time as the runner moves
  3. Elapsed time counts up during active running and pauses when the run is paused
  4. Remaining distance to the finish is displayed based on route progress
  5. All metrics use large fonts and high contrast, readable at a glance while running at pace
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Navigation Polish
**Goal**: Turn-by-turn navigation is reliable, informative, and works correctly on iOS Safari in standalone PWA mode
**Depends on**: Phase 2
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. Map auto-rotates to match the runner's heading during active navigation
  2. Runner is alerted when deviating more than 50m from the planned route with guidance to return
  3. Voice cues announce distance milestones ("1 kilometer completed", "Halfway point")
  4. Runner can mute/unmute voice navigation without stopping the run
  5. Voice navigation works on iOS Safari in standalone PWA mode (audio context unlocked on user gesture)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Run Summary
**Goal**: After finishing a run, the runner sees a reward screen with their achievement and can save or discard the result
**Depends on**: Phase 3
**Requirements**: SUMM-01, SUMM-02, SUMM-03, SUMM-04
**Success Criteria** (what must be TRUE):
  1. After completing or ending a run, a summary screen shows total distance, elapsed time, and average pace
  2. Summary displays a map with the actual GPS trace overlaid on the planned route
  3. User can save the completed run to history or discard it
  4. Estimated calories burned is displayed based on distance and configurable body weight
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Run History & Saved Routes
**Goal**: Runners can browse their past runs and save favorite routes for reuse
**Depends on**: Phase 5
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04, ROUT-01, ROUT-02, ROUT-03, ROUT-04
**Success Criteria** (what must be TRUE):
  1. History view lists all past runs sorted by date with distance, time, pace, and route thumbnail per entry
  2. Tapping a past run shows full details with the route displayed on the map
  3. User can delete individual runs from history
  4. User can save a generated route as a favorite and see it in a saved routes list with name, distance, and thumbnail
  5. User can load a saved route onto the map and start navigation from it
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Route Visualization
**Goal**: Routes on the map look beautiful — elevation gradients, clear markers, and turn indicators make the route a visual product
**Depends on**: Phase 1
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05
**Success Criteria** (what must be TRUE):
  1. Route lines are smooth and anti-aliased on the map
  2. Route color shifts along a gradient indicating elevation changes (green for flat, orange for uphill, red for steep)
  3. Start and finish point is clearly marked on every route
  4. Turn indicators appear at key decision points along the route
  5. All route colors and markers use a dark-mode-optimized palette that looks premium on OLED screens
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

### Phase 8: UI/UX & PWA Polish
**Goal**: The app feels as polished as Runkeeper — consistent design system, fluid animations, haptic feedback, and offline-capable PWA
**Depends on**: Phase 7
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, PWA-01, PWA-02, PWA-03, PWA-04
**Success Criteria** (what must be TRUE):
  1. Dark mode is the default theme with a consistent design system (typography, spacing, colors, buttons) across all screens
  2. Screen transitions use fluid animations (Motion library) that feel native
  3. Key interactions (start run, pause, milestone) trigger haptic feedback on supported devices
  4. All screens are optimized for iPhone viewport (375-430px) with no horizontal scroll or overflow
  5. Service worker caches app shell so the app loads offline after first visit
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

Note: Phase 4 (Navigation) and Phase 7 (Visualization) can run in parallel with their respective chains since they have independent dependency paths. Phase 4 depends on Phase 2; Phase 7 depends on Phase 1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Storage & GPS Foundation | 4/5 | Complete    | 2026-03-20 |
| 2. Run Session Lifecycle | 2/2 | Complete    | 2026-03-20 |
| 3. Live Run Metrics | 0/1 | Not started | - |
| 4. Navigation Polish | 0/1 | Not started | - |
| 5. Run Summary | 0/1 | Not started | - |
| 6. Run History & Saved Routes | 0/1 | Not started | - |
| 7. Route Visualization | 0/1 | Not started | - |
| 8. UI/UX & PWA Polish | 0/1 | Not started | - |
