# RundLoop

## What This Is

RundLoop is a mobile-first Progressive Web App for runners that generates beautiful loop routes of a specified distance, shows the full route before the run begins, and provides GPS-guided turn-by-turn navigation during the run. The v1.0 MVP ships with GPS navigation and live metrics, route visualization with elevation gradients and turn indicators, run history and saved routes, voice guidance with iOS audio unlock, post-run summaries with GPS trace overlay, progress analytics, route sharing (unique links and GPX export), and full PWA offline support with service worker caching. Built with Next.js, MapLibre GL JS, OSRM foot-routing, and IndexedDB persistence.

## Core Value

Runners see the entire loop route upfront before taking a single step — no surprises, no dead ends, no awkward out-and-back segments.

## Requirements

### Validated

- ✓ Basic route generation (AI and algorithmic modes) — v1.0
- ✓ Distance slider with binary search calibration — v1.0
- ✓ Multi-sample retry for waypoint convergence — v1.0
- ✓ MapLibre map rendering with route display — v1.0
- ✓ Basic GPS tracking via Geolocation API — v1.0
- ✓ Voice navigation via Web Speech API — v1.0
- ✓ Next.js app with Tailwind CSS styling — v1.0
- ✓ PWA manifest and service worker — v1.0
- ✓ OSRM foot-routing integration — v1.0
- ✓ Claude Haiku API for AI route generation — v1.0
- ✓ Settings view — v1.0
- ✓ Vercel deployment — v1.0
- ✓ IndexedDB persistence layer (runs, routes, settings stores) — v1.0
- ✓ GPS position filtering (30m accuracy, 3m jitter, 12.5m/s teleport rejection) — v1.0
- ✓ Wake Lock API integration with iOS visibility re-acquisition — v1.0
- ✓ Crash recovery via periodic IndexedDB snapshots — v1.0
- ✓ Storage persistence request to prevent iOS 7-day eviction — v1.0
- ✓ localStorage to IndexedDB migration — v1.0
- ✓ Run session state machine (idle/active/paused/completed) — v1.0
- ✓ Pause/resume with timer and GPS tracking coordination — v1.0
- ✓ End run with confirmation dialog — v1.0
- ✓ Crash recovery detection and resume/discard dialog — v1.0
- ✓ GPS filter wired into app (watchFilteredPosition replaces watchPosition) — v1.0
- ✓ Rolling pace calculation (30 s sliding window over GPS samples) — v1.0
- ✓ Live distance accumulation from filtered GPS positions — v1.0
- ✓ Elapsed time display (timer driven by run session state machine) — v1.0
- ✓ Remaining distance overlay (route geometry minus completed distance) — v1.0
- ✓ Live run metrics overlay wired into NavigationView — v1.0
- ✓ Map auto-rotation (heading-up bearing locked to GPS course) — v1.0
- ✓ Off-route detection with automatic rerouting prompt — v1.0
- ✓ Voice distance milestones (every km/mile announcement) — v1.0
- ✓ iOS audio unlock (silent AudioContext tap to bypass autoplay policy) — v1.0
- ✓ Post-run summary screen with stats (distance, duration, pace, calories) — v1.0
- ✓ GPS trace overlay on summary map — v1.0
- ✓ Save/discard run at end of session — v1.0
- ✓ Calorie estimation from distance and elapsed time — v1.0
- ✓ Run history browsing with IndexedDB persistence and route thumbnails — v1.0
- ✓ Saved routes management (save, list, reuse favorite routes) — v1.0
- ✓ Bottom tab navigation (map/history/saved routes/settings) — v1.0
- ✓ Gap closure for pre-existing TypeScript errors — v1.0
- ✓ Elevation gradient route coloring (speed/altitude-based color ramp) — v1.0
- ✓ Dark-mode OLED map tiles (custom dark tile style optimized for OLED screens) — v1.0
- ✓ Start/finish markers (distinct icons at route endpoints) — v1.0
- ✓ Turn indicators (directional arrows along route at waypoints) — v1.0
- ✓ Premium UI/UX (Runkeeper-quality design, dark mode default, haptic feedback, fluid animations) — v1.0
- ✓ Service worker for offline app shell caching — v1.0
- ✓ Progress analytics (weekly/monthly summaries, pace trends, personal records) — v1.0
- ✓ Route sharing (unique links, GPX export) — v1.0
- ✓ Cross-phase wiring fixes (route polyline in history, unit propagation, calories, default distance) — v1.0
- ✓ PWA icons (192px and 512px) and manifest completion — v1.0
- ✓ Dead code cleanup (removed unused /api/generate-route) — v1.0

### Active

(Planning next milestone)

### Out of Scope

- Heart rate monitoring (Web Bluetooth) — Phase 2, high complexity
- Elevation profile chart — Phase 2
- Offline map tile caching — Phase 2, storage/bandwidth complexity
- User accounts and authentication — Phase 3 (SaaS)
- Subscription model and Stripe integration — Phase 3
- Social features (follow, feed, kudos, leaderboards) — Phase 3
- Native app wrapper (Capacitor) — Phase 3+
- Strava integration — Phase 3+
- Terrain preferences for algorithmic mode — open question, defer

## Context

- v1.0 MVP shipped 2026-03-21 at rundloop.vercel.app
- ~125 tests across unit and integration suites
- Tech stack: Next.js, TypeScript, Tailwind CSS 4, MapLibre GL JS, OSRM (foot profile), Claude Haiku API, IndexedDB
- Hosted on Vercel, deployed from main branch
- Primary target: iPhone/iOS Safari as installed PWA (375px-430px width)
- Visual benchmark: Runkeeper — app must look and feel as polished or better
- Design philosophy: dark mode default, glanceable while running, beautiful routes are the product
- All API keys must be server-side only (Next.js API routes)
- Privacy-first: no tracking that identifies individual users, no selling data

## Constraints

- **Platform**: Must work as PWA on iOS Safari — no native-only APIs
- **Performance**: First contentful paint < 1.5s, map at 60fps, route generation < 10s for ≤21 km
- **Battery**: GPS tracking ≤ 15% battery drain per hour
- **Accessibility**: Minimum AA contrast ratios, screen reader support for non-map UI
- **Security**: API keys server-side only, HTTPS everywhere
- **Reliability**: GPS nav must survive brief network drops, voice nav continues if map tiles fail
- **Design**: Mobile-first always, dark mode default, no clutter, no ads

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA over native app | Faster iteration, no app store friction, works across platforms | Validated in v1.0 |
| Dark mode as default | Runners often run early/late, saves battery on OLED, premium feel | Validated in v1.0 |
| OSRM for routing | Free, self-hostable, foot profile available, already integrated | Validated in v1.0 |
| IndexedDB for local storage | No backend needed for personal use, fast, offline-capable | Validated in v1.0 |
| Fine granularity for phases | Complex feature set benefits from focused phases | Validated in v1.0 |

## Current State

v1.0 MVP shipped. All 10 phases (28 plans) completed and validated. The app delivers GPS-guided turn-by-turn navigation, live run metrics, route visualization with elevation gradients and turn indicators, run history and saved routes, voice guidance with iOS audio unlock, post-run summaries, progress analytics, route sharing, and full PWA offline support.

---
*Last updated: 2026-03-21 after v1.0 milestone*
