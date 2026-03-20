# Requirements: RundLoop

**Defined:** 2026-03-19
**Core Value:** Runners see the entire loop route upfront before taking a single step

## v1 Requirements

Requirements for Phase 1 polish milestone. Each maps to roadmap phases.

### GPS Foundation

- [x] **GPS-01**: GPS positions are filtered for accuracy (reject low-accuracy readings, minimum distance delta, teleport detection)
- [x] **GPS-02**: GPS tracking survives brief network drops without crashing or losing position data
- [x] **GPS-03**: Wake Lock API keeps screen on during active navigation
- [x] **GPS-04**: Run state is periodically snapshot to IndexedDB for crash recovery

### Storage

- [x] **STOR-01**: Run history persisted to IndexedDB (replacing localStorage) with full GPS traces
- [x] **STOR-02**: Saved/favorite routes persisted to IndexedDB with name and route data
- [x] **STOR-03**: Storage persistence requested via navigator.storage.persist() to prevent iOS eviction
- [x] **STOR-04**: Settings and user preferences persisted to IndexedDB

### Run Session Lifecycle

- [x] **RUN-01**: Run session state machine (idle → active → paused → completed) prevents impossible states
- [x] **RUN-02**: User can pause and resume a run with timer and GPS tracking pausing/resuming correctly
- [x] **RUN-03**: User can end a run with confirmation dialog
- [x] **RUN-04**: Crashed/interrupted runs are detected on app relaunch with option to recover or discard

### Live Run Metrics

- [x] **METR-01**: Current pace displayed as rolling lap pace (per-km average, not instantaneous GPS)
- [x] **METR-02**: Total distance covered displayed in real-time
- [x] **METR-03**: Elapsed time displayed (paused time excluded) *(partial — Phase 9 addresses calorie estimation wiring with bodyWeightKg from settings)*
- [x] **METR-04**: Remaining distance to finish displayed
- [x] **METR-05**: Stats panel uses large fonts and high contrast, readable at a glance while running

### Run Summary

- [x] **SUMM-01**: After completing or ending a run, summary screen shows total distance, time, and average pace
- [x] **SUMM-02**: Summary shows map with actual GPS trace overlaid on planned route
- [x] **SUMM-03**: User can save or discard the completed run
- [x] **SUMM-04**: Estimated calories burned displayed (based on distance and configurable body weight)

### Route Visualization

- [x] **VIZ-01**: Smooth, anti-aliased route lines on the map *(partial — Phase 9 addresses gradient route display in RunDetailOverlay for completed runs)*
- [x] **VIZ-02**: Colored gradient along the route indicating elevation changes (green flat, yellow/orange uphill, red steep)
- [x] **VIZ-03**: Clear start/finish marker on the route
- [x] **VIZ-04**: Turn indicators at key decision points along the route
- [x] **VIZ-05**: Dark-mode-friendly color scheme optimized for OLED screens

### Navigation Polish

- [x] **NAV-01**: Map auto-rotates to follow the runner's heading during active navigation
- [x] **NAV-02**: Off-route detection alerts runner when deviating >50m from planned route with guidance to return
- [x] **NAV-03**: Distance milestone voice cues ("1 kilometer completed", "Halfway point")
- [x] **NAV-04**: Option to mute/unmute voice navigation without stopping the run
- [x] **NAV-05**: Voice navigation works reliably on iOS Safari (user-gesture audio unlock, post-background reset)

### UI/UX Polish

- [x] **UI-01**: Dark mode as default theme with consistent design system (typography, spacing, colors, buttons)
- [x] **UI-02**: Fluid animations and transitions between screens (Motion library)
- [x] **UI-03**: Haptic feedback on key interactions (start run, pause, milestone) via Vibration API with iOS fallback
- [x] **UI-04**: Mobile-first responsive design optimized for iPhone (375px-430px width)
- [x] **UI-05**: Clean, minimal interface with no clutter — premium feel through restraint *(partial — Phase 9 addresses defaultDistance seeding from settings)*

### Run History

- [x] **HIST-01**: History view lists all past runs sorted by date (newest first)
- [x] **HIST-02**: Each history entry shows date, distance, time, pace, and small route thumbnail
- [x] **HIST-03**: User can tap a past run to see full details and route on map *(partial — Phase 9 addresses route polyline display and unit propagation in detail view)*
- [x] **HIST-04**: User can delete individual runs from history

### Saved Routes

- [x] **ROUT-01**: User can save a generated route as a favorite (before or after running it)
- [x] **ROUT-02**: List of saved routes with name, distance, and thumbnail
- [x] **ROUT-03**: User can re-run a saved route (load onto map and start navigation)
- [x] **ROUT-04**: User can rename saved routes

### PWA & Offline

- [x] **PWA-01**: Service worker caches app shell for offline loading *(partial — Phase 10 addresses missing PWA icons and dead server route cleanup)*
- [x] **PWA-02**: App icon and splash screen configured for iOS Safari Add to Home Screen
- [x] **PWA-03**: Standalone display mode (no Safari chrome visible)
- [x] **PWA-04**: Smooth 60fps interactions during map rendering and navigation

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analytics

- **ANAL-01**: Weekly and monthly summaries (total distance, time, number of runs)
- **ANAL-02**: Pace trend chart over last 4/8/12 weeks
- **ANAL-03**: Distance trend chart (weekly distance over time)
- **ANAL-04**: Personal records (fastest 5K, 10K, half-marathon, marathon)

### Route Sharing

- **SHAR-01**: Share route via unique link
- **SHAR-02**: Shared page shows route on map with distance and estimated time
- **SHAR-03**: Recipient can open route in their own RundLoop app
- **SHAR-04**: Export route as GPX file

### Elevation Profile

- **ELEV-01**: Elevation profile chart for generated route before starting
- **ELEV-02**: Cumulative elevation gain/loss during run

## Out of Scope

| Feature | Reason |
|---------|--------|
| Heart rate monitoring (Web Bluetooth) | High complexity, iOS PWA limitations, Phase 2+ |
| Offline map tile caching | Storage/bandwidth complexity, Phase 2+ |
| User accounts & authentication | Phase 3 SaaS feature |
| Stripe subscription model | Phase 3 SaaS feature |
| Social features (follow, feed, kudos) | Strava/NRC own this space, anti-feature |
| Training plans & coaching | Anti-feature — not RundLoop's value prop |
| Native app wrapper (Capacitor) | Phase 3+, PWA-first approach |
| Strava integration | Phase 3+, depends on user accounts |
| Real-time chat | High complexity, not core to running |
| Video content | Storage/bandwidth costs |
| Instantaneous GPS pace display | Too volatile, misleading — use rolling lap pace instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GPS-01 | Phase 1 | Complete |
| GPS-02 | Phase 1 | Complete |
| GPS-03 | Phase 1 | Complete |
| GPS-04 | Phase 1 | Complete |
| STOR-01 | Phase 1 | Complete |
| STOR-02 | Phase 1 | Complete |
| STOR-03 | Phase 1 | Complete |
| STOR-04 | Phase 1 | Complete |
| RUN-01 | Phase 2 | Complete |
| RUN-02 | Phase 2 | Complete |
| RUN-03 | Phase 2 | Complete |
| RUN-04 | Phase 2 | Complete |
| METR-01 | Phase 3 | Complete |
| METR-02 | Phase 3 | Complete |
| METR-03 | Phase 3 | Complete |
| METR-04 | Phase 3 | Complete |
| METR-05 | Phase 3 | Complete |
| NAV-01 | Phase 4 | Complete |
| NAV-02 | Phase 4 | Complete |
| NAV-03 | Phase 4 | Complete |
| NAV-04 | Phase 4 | Complete |
| NAV-05 | Phase 4 | Complete |
| SUMM-01 | Phase 5 | Complete |
| SUMM-02 | Phase 5 | Complete |
| SUMM-03 | Phase 5 | Complete |
| SUMM-04 | Phase 5 | Complete |
| HIST-01 | Phase 6 | Complete |
| HIST-02 | Phase 6 | Complete |
| HIST-03 | Phase 6 | Complete |
| HIST-04 | Phase 6 | Complete |
| ROUT-01 | Phase 6 | Complete |
| ROUT-02 | Phase 6 | Complete |
| ROUT-03 | Phase 6 | Complete |
| ROUT-04 | Phase 6 | Complete |
| VIZ-01 | Phase 7 | Complete |
| VIZ-02 | Phase 7 | Complete |
| VIZ-03 | Phase 7 | Complete |
| VIZ-04 | Phase 7 | Complete |
| VIZ-05 | Phase 7 | Complete |
| UI-01 | Phase 8 | Complete |
| UI-02 | Phase 8 | Complete |
| UI-03 | Phase 8 | Complete |
| UI-04 | Phase 8 | Complete |
| UI-05 | Phase 8 | Complete |
| PWA-01 | Phase 8 | Complete |
| PWA-02 | Phase 8 | Complete |
| PWA-03 | Phase 8 | Complete |
| PWA-04 | Phase 8 | Complete |
| HIST-03 | Phase 9 | Not started (gap closure) |
| VIZ-01 | Phase 9 | Not started (gap closure) |
| METR-03 | Phase 9 | Not started (gap closure) |
| UI-05 | Phase 9 | Not started (gap closure) |
| PWA-01 | Phase 10 | Not started (gap closure) |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
