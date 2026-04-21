# RundLoop - Product Requirements Document

## Overview

RundLoop is a mobile-first Progressive Web App for runners that generates beautiful loop routes of a specified distance, shows the full route before the run begins, and provides GPS-guided turn-by-turn navigation during the run. The key differentiator is that runners see the entire loop upfront, unlike traditional apps where you just start running and hope the route works out.

The app is built with Next.js, MapLibre GL JS, and OSRM foot-routing. An MVP is live at rundloop.vercel.app with basic route generation (AI and algorithmic modes), distance calibration, and rudimentary voice navigation.

## Vision

**Phase 1 (Personal + Friends):** A polished, fully functional running app for personal use and sharing with a small group. All core features working reliably on iOS Safari as a PWA.

**Phase 2 (Public Launch):** Open the app to all runners. Focus on retention through run history, analytics, and route sharing. Optimize performance and reliability for a broad audience.

**Phase 3 (SaaS):** Introduce user accounts, a free tier (3 routes/month, basic tracking), and a paid subscription (49 SEK/month) for unlimited routes, AI mode, full analytics, and social features. Stripe integration for payments.

## Target Users

- **Primary:** Recreational runners (5-21 km range) who want variety in their routes without planning manually.
- **Secondary:** Marathon/ultra trainers who need specific distances (30-42 km) with interesting routes.
- **Tertiary:** Casual joggers who want a "just press go" experience for a quick 3-5 km loop.

All users are assumed to be on mobile (primarily iPhone/iOS Safari), running the app as an installed PWA.

## Core Features

Features are listed in priority order within each tier.

### P0 - Must Have (Phase 1)

#### 1. Route Generation
- **Status:** Partially complete.
- Two generation modes: AI (Claude Haiku API) and Algorithmic (circle, figure-8, cloverleaf patterns).
- Distance slider from 3 km to 50 km with quick-select presets at 3, 5, 7, 10, 15, 21, 30, 42 km.
- Binary search distance calibration targeting within 20% of requested distance via OSRM foot-routing.
- Multi-sample retry (up to 3 different waypoint sets) if calibration does not converge.
- Routes must produce visually attractive loops. No ugly zigzags or out-and-back patterns. Smooth, organic shapes that follow real roads and paths.
- Show the complete route on the map BEFORE the run starts. This is the core value proposition.

#### 2. Beautiful Route Visualization
- Smooth, anti-aliased route lines on the map.
- Colored gradient along the route indicating elevation changes (green for flat, yellow/orange for uphill, red for steep).
- Clear start/finish marker.
- Turn indicators at key decision points along the route.
- Dark-mode-friendly color scheme that looks great on OLED screens.

#### 3. GPS Navigation During Run
- Real-time GPS tracking using the browser Geolocation API with high accuracy mode.
- Current position shown on the map as a prominent, animated dot.
- Map auto-rotates to follow the runner's heading.
- Turn-by-turn voice navigation via Web Speech API: "Turn left in 50 meters," "Continue straight for 200 meters."
- Audio cues for distance milestones: "1 kilometer completed," "5 kilometers completed," "Halfway point."
- Off-route detection: alert the runner if they deviate more than 50 meters from the planned route, with guidance to return.
- Option to mute/unmute voice navigation without stopping the run.
- Keep-screen-on behavior during active navigation (Wake Lock API).

#### 4. Live Run Metrics
- Real-time stats overlay during the run, visible at a glance:
  - Current pace (min/km).
  - Total distance covered (km).
  - Elapsed time.
  - Remaining distance.
- Stats panel must be large enough to read while running (large fonts, high contrast).
- Pause/resume functionality.
- End run button with confirmation dialog.

#### 5. Run Summary
- After completing (or ending) a run, show a summary screen with:
  - Total distance, total time, average pace.
  - Estimated calories burned (based on distance and a configurable body weight).
  - Elevation gain/loss (if elevation data is available from OSRM or a secondary source).
  - Map showing the completed route with the actual GPS trace overlaid.
  - Option to save or discard the run.

#### 6. Mobile-First PWA
- Fully responsive design optimized for iPhone screen sizes (375px - 430px width).
- Installable via Safari "Add to Home Screen."
- Standalone display mode (no Safari chrome visible).
- App icon and splash screen.
- Service worker for basic offline support (app shell caching).
- Smooth 60fps interactions, no jank during map rendering or navigation.

#### 7. Premium UI/UX Design
- Visual benchmark: Runkeeper. The app must look and feel as polished as Runkeeper or better.
- Clean, minimal interface. No clutter, no ads, ever.
- Dark mode as the default theme, with optional light mode.
- Consistent design system: typography, spacing, color palette, button styles.
- Fluid animations and transitions between screens.
- Haptic feedback on key interactions (start run, pause, milestone) via Vibration API.

### P1 - Should Have (Phase 1-2)

#### 8. Run History
- Persist completed runs locally (IndexedDB/localStorage for Phase 1, Supabase for Phase 2+).
- History view listing all past runs, sorted by date (newest first).
- Each entry shows: date, distance, time, pace, and a small route thumbnail.
- Tap a past run to see full details and the route on the map.
- Delete individual runs from history.

#### 9. Save and Reuse Routes
- Save a generated route as a favorite (before or after running it).
- List of saved/favorite routes with name, distance, and thumbnail.
- Re-run a saved route: load it onto the map and start navigation.
- Rename saved routes.

#### 10. Progress Analytics
- Weekly and monthly summaries: total distance, total time, number of runs.
- Pace trend chart: average pace over the last 4/8/12 weeks.
- Distance trend chart: weekly distance over time.
- Personal records: fastest 5K, 10K, half-marathon, marathon (auto-detected from run data).
- Simple, clean chart design. No overly complex dashboards.

#### 11. Route Sharing
- Share a route via a unique link (e.g., rundloop.vercel.app/route/abc123).
- The shared page shows the route on a map with distance and estimated time.
- Recipient can open the route in their own RundLoop app and run it.
- Export a route as a GPX file for use in other apps (Garmin, Strava, etc.).

### P2 - Nice to Have (Phase 2-3)

#### 12. Heart Rate Monitoring
- Connect to Bluetooth heart rate monitors via Web Bluetooth API.
- Display current heart rate in the live stats overlay.
- Heart rate zones visualization (easy, moderate, hard, max).
- Include heart rate data in run summary and history.

#### 13. Elevation Profile
- Show an elevation profile chart for the generated route before starting the run.
- Display cumulative elevation gain/loss during the run.
- Color-code the route on the map by gradient steepness.

#### 14. Offline Map Caching
- Cache map tiles for the route area before starting the run.
- Allow navigation to continue even if the phone loses data connection mid-run.
- Pre-cache tiles along the generated route corridor.

### P3 - Future (Phase 3, SaaS)

#### 15. User Accounts
- Sign up / sign in with email or Google OAuth.
- User profile with name, profile photo, body weight (for calorie estimation), preferred units.
- All run history and saved routes synced to the cloud via Supabase.

#### 16. Subscription Model
- **Free tier:** 3 route generations per month, basic run tracking, run history (local only).
- **Paid tier (49 SEK/month):** Unlimited route generations, AI mode, full analytics, cloud sync, route sharing, GPX export.
- Stripe integration for subscription management.
- Trial period: 14 days of full access for new users.

#### 17. Social Features
- Follow other runners.
- See friends' recent runs in a feed.
- Compare stats with friends (weekly distance, pace).
- Kudos/reactions on completed runs.
- Leaderboards (opt-in): weekly distance, streak length.

## Technical Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16.2.0 | App Router, TypeScript, already set up |
| Styling | Tailwind CSS 4 | Already set up |
| Maps | MapLibre GL JS | OpenStreetMap raster tiles, already set up |
| Routing | OSRM (foot profile) | External API for road/path routing, already set up |
| AI Routes | Claude Haiku API | Anthropic API for intelligent waypoint generation, already set up |
| Hosting | Vercel | Already deployed at rundloop.vercel.app |
| Database | Supabase | For Phase 2+. Run history, user accounts, saved routes |
| Payments | Stripe | For Phase 3. 49 SEK/month subscription |
| Voice | Web Speech API | Turn-by-turn navigation audio |
| GPS | Geolocation API | High-accuracy mode for run tracking |
| Offline | Service Worker | App shell caching, optional map tile caching |
| PWA | next-pwa or custom SW | Manifest, icons, splash screens |
| Bluetooth | Web Bluetooth API | Heart rate monitors (Phase 2) |
| Analytics | Vercel Analytics or Plausible | Privacy-friendly, no Google Analytics |

## Design Principles

1. **Mobile-first, always.** Every screen is designed for a 375px-wide phone held in one hand while running. Desktop is secondary.

2. **Glanceable while running.** During an active run, all critical information (pace, distance, time) must be readable in under 1 second with a quick glance. Large fonts, high contrast, minimal visual noise.

3. **Beautiful routes are the product.** The route on the map is the hero element. Invest in rendering quality: smooth lines, elevation gradients, attractive colors. A screenshot of a RundLoop route should look good enough to share on Instagram.

4. **Show the loop before the run.** This is the core differentiator. The full route is visible and explorable before the runner takes a single step. No surprises, no dead ends, no awkward out-and-back segments.

5. **No clutter, no ads, ever.** Every pixel serves the runner. Premium feel through restraint, not through feature overload.

6. **Dark mode default.** Runners often run early morning or evening. Dark mode reduces glare, saves battery on OLED, and looks premium.

7. **Offline-resilient.** GPS navigation must not break if the phone loses cellular data mid-run. Cache aggressively.

8. **Progressive enhancement.** Core features (route generation, GPS tracking) work on any modern mobile browser. Enhanced features (voice nav, heart rate, haptics) activate when the browser supports them, degrade gracefully when it does not.

## Success Metrics

### Phase 1 (Personal Use)
- Route generation succeeds on first attempt > 80% of the time.
- Generated route distance is within 20% of the requested distance.
- GPS navigation works reliably for a full run without crashing or losing position.
- App loads in under 3 seconds on 4G.
- PWA installs and runs in standalone mode on iOS Safari without issues.

### Phase 2 (Public Launch)
- 100+ monthly active users within 3 months of launch.
- Average 2+ runs per active user per week.
- Run completion rate > 70% (started runs that are finished, not abandoned).
- Route sharing generates at least 10% of new user acquisitions.
- App Store rating equivalent of 4.5+ stars (measured via feedback form).

### Phase 3 (SaaS)
- 5% free-to-paid conversion rate.
- Monthly churn below 8%.
- 500+ paying subscribers within 12 months.
- Monthly recurring revenue target: 24,500 SEK (500 x 49 SEK).

## Phasing

### Phase 1: Core Running App (Target: 4-6 weeks)
**Goal:** A fully functional, polished running app for personal use and sharing with friends.

- P0 features 1-7: Route generation, beautiful visualization, GPS navigation, live metrics, run summary, PWA, premium UI.
- P1 feature 8: Run history (local storage via IndexedDB).
- P1 feature 9: Save and reuse routes (local storage).
- Testing with real runs. Fix GPS edge cases, voice nav timing, off-route detection accuracy.
- Performance optimization: map rendering, GPS battery usage, service worker caching.

### Phase 2: Public Launch (Target: 4-6 weeks after Phase 1)
**Goal:** Open to all runners. Add analytics, sharing, and cloud persistence.

- Set up Supabase for cloud storage (run history, saved routes, user preferences).
- P1 feature 10: Progress analytics (charts, personal records).
- P1 feature 11: Route sharing (unique links, GPX export).
- P2 feature 12: Heart rate monitoring (Web Bluetooth).
- P2 feature 13: Elevation profile display.
- P2 feature 14: Offline map tile caching.
- Landing page with app description, screenshots, and "Add to Home Screen" instructions.
- Submit to PWA directories and running communities.

### Phase 3: SaaS (Target: 4-8 weeks after Phase 2)
**Goal:** Monetize with subscriptions. Add social features.

- P3 feature 15: User accounts (email + Google OAuth via Supabase Auth).
- P3 feature 16: Stripe subscription (free tier, 49 SEK/month paid tier).
- P3 feature 17: Social features (follow, feed, kudos, leaderboards).
- Optional: Capacitor wrapper for native App Store / Google Play distribution.
- Marketing: running subreddits, Strava clubs, Swedish running communities.

## Non-Functional Requirements

- **Performance:** First contentful paint under 1.5 seconds. Map interaction at 60fps. Route generation completes in under 10 seconds for distances up to 21 km.
- **Battery:** GPS tracking must not drain more than 15% battery per hour of active running.
- **Privacy:** No tracking, no analytics that identify individual users. Run data belongs to the user. No selling data, ever.
- **Accessibility:** Minimum AA contrast ratios. Voice navigation serves as an accessibility feature for visually impaired runners. Screen reader support for non-map UI elements.
- **Security:** All API keys server-side only (Next.js API routes). Supabase Row Level Security for user data. HTTPS everywhere.
- **Reliability:** GPS navigation must survive brief network drops without crashing. Voice nav continues even if map tiles fail to load.

## Open Questions

1. Should the algorithmic mode support terrain preferences (prefer parks, avoid highways, prefer trails)?
2. What is the right off-route threshold: 50m, 100m, or user-configurable?
3. Should we integrate with Strava for automatic run sync (Phase 2 or 3)?
4. Is Capacitor necessary for Phase 2, or can PWA alone handle iOS distribution?
5. Should the free tier include AI routes or only algorithmic routes?
