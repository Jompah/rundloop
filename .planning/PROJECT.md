# RundLoop

## What This Is

RundLoop is a mobile-first Progressive Web App for runners that generates beautiful loop routes of a specified distance, shows the full route before the run begins, and provides GPS-guided turn-by-turn navigation during the run. Built with Next.js, MapLibre GL JS, and OSRM foot-routing, with an MVP already live at rundloop.vercel.app.

## Core Value

Runners see the entire loop route upfront before taking a single step — no surprises, no dead ends, no awkward out-and-back segments.

## Requirements

### Validated

- ✓ Basic route generation (AI and algorithmic modes) — existing
- ✓ Distance slider with binary search calibration — existing
- ✓ Multi-sample retry for waypoint convergence — existing
- ✓ MapLibre map rendering with route display — existing
- ✓ Basic GPS tracking via Geolocation API — existing
- ✓ Rudimentary voice navigation via Web Speech API — existing
- ✓ Next.js app with Tailwind CSS styling — existing
- ✓ PWA manifest and basic setup — existing
- ✓ OSRM foot-routing integration — existing
- ✓ Claude Haiku API for AI route generation — existing
- ✓ Settings view — existing
- ✓ History view (basic) — existing
- ✓ Vercel deployment — existing
- ✓ IndexedDB persistence layer (runs, routes, settings stores) — Phase 1
- ✓ GPS position filtering (30m accuracy, 3m jitter, 12.5m/s teleport rejection) — Phase 1
- ✓ Wake Lock API integration with iOS visibility re-acquisition — Phase 1
- ✓ Crash recovery via periodic IndexedDB snapshots — Phase 1
- ✓ Storage persistence request to prevent iOS 7-day eviction — Phase 1
- ✓ localStorage to IndexedDB migration — Phase 1
- ✓ Run session state machine (idle/active/paused/completed) — Phase 2
- ✓ Pause/resume with timer and GPS tracking coordination — Phase 2
- ✓ End run with confirmation dialog — Phase 2
- ✓ Crash recovery detection and resume/discard dialog — Phase 2
- ✓ GPS filter wired into app (watchFilteredPosition replaces watchPosition) — Phase 2
- ✓ Rolling pace calculation (30 s sliding window over GPS samples) — Phase 3
- ✓ Live distance accumulation from filtered GPS positions — Phase 3
- ✓ Elapsed time display (timer driven by run session state machine) — Phase 3
- ✓ Remaining distance overlay (route geometry minus completed distance) — Phase 3
- ✓ Live run metrics overlay wired into NavigationView — Phase 3

### Active

- [ ] Beautiful route visualization (elevation gradients, turn indicators, dark-mode colors)
- [ ] Polished GPS navigation (map auto-rotation, off-route detection, distance milestones)
- [ ] Run summary screen (stats, GPS trace overlay, save/discard)
- [ ] Premium UI/UX (Runkeeper-quality design, dark mode default, haptic feedback, fluid animations)
- [ ] Run history with IndexedDB persistence and route thumbnails
- [ ] Save and reuse favorite routes
- [ ] Service worker for offline app shell caching
- [ ] Progress analytics (weekly/monthly summaries, pace trends, personal records)
- [ ] Route sharing (unique links, GPX export)

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

- MVP is live at rundloop.vercel.app with basic route generation and navigation
- Tech stack: Next.js 16.2.0, Tailwind CSS 4, MapLibre GL JS, OSRM (foot profile), Claude Haiku API
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
| PWA over native app | Faster iteration, no app store friction, works across platforms | — Pending |
| Dark mode as default | Runners often run early/late, saves battery on OLED, premium feel | — Pending |
| OSRM for routing | Free, self-hostable, foot profile available, already integrated | — Pending |
| IndexedDB for local storage (Phase 1) | No backend needed for personal use, fast, offline-capable | — Pending |
| Fine granularity for phases | Complex feature set benefits from focused phases | — Pending |

---
*Last updated: 2026-03-20 after Phase 3 completion*
