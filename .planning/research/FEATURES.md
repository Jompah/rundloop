# Feature Landscape

**Domain:** Mobile-first running PWA with route generation, GPS navigation, and run tracking
**Researched:** 2026-03-19

## Table Stakes

Features users expect from any running app. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **GPS tracking with live position** | Every running app does this. Without it, there is no app. | Med | Already partially built. Must handle iOS Safari PWA session permission re-requests. |
| **Live pace display (current km pace)** | Runners glance at pace constantly. The single most checked metric. | Med | Use rolling lap pace (current km), NOT instantaneous GPS speed which is too volatile and frustrating. |
| **Live distance counter** | Runners want to know how far they have gone at all times. | Low | Accumulate from GPS points. Already have distance in route data. |
| **Elapsed time display** | Fundamental metric alongside pace and distance. | Low | Simple timer, must survive pause/resume. |
| **Pause/resume run** | Runners stop at traffic lights, water stops, bathroom breaks. | Med | Must freeze timer and distance accumulation. GPS can keep tracking for resume accuracy. |
| **End run with confirmation** | Prevent accidental run termination. | Low | Simple confirmation dialog, already planned. |
| **Run summary after completion** | Runners want to see their stats immediately after stopping. | Med | Distance, time, average pace, map with GPS trace. This is the reward moment. |
| **Run history list** | Runners track progress over time. Without history, each run is disposable. | Med | Sorted by date, showing distance/time/pace per entry. IndexedDB for Phase 1. |
| **Dark mode** | Runners run early morning and evening. Glare is a real problem. OLED battery savings. | Low | Already planned as default. Most running apps now default to dark. |
| **Keep screen on during run** | If screen locks mid-run, navigation and metrics are useless. | Low | Wake Lock API. Critical for usability. Falls back to "tap to wake" if unsupported. |
| **Audio distance milestones** | "1 kilometer", "5 kilometers" etc. Runners expect audio feedback without looking at phone. | Low | Web Speech API. Already partially built. Every major app does this. |
| **Start/finish marker on route** | Runners need to know where the loop begins and ends. | Low | Already implied in route display. |
| **Route display on map before run** | This is RundLoop's core proposition but it is also table stakes for any route-planning app. | Low | Already built. |

## Differentiators

Features that set RundLoop apart. Not expected by default, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automatic loop route generation** | The core differentiator. No other mainstream app generates beautiful loop routes automatically from a distance input. RunGen and RouteShuffle exist but are basic. Strava/NRC do not generate routes at all. | Already built | Two modes (AI + algorithmic) already working. Polish is the differentiator, not the feature itself. |
| **Full route preview before running** | Runners see the entire loop, elevation profile, and turn points before taking a step. Strava shows routes only after manual creation. NRC shows nothing. | Med | Already partially built. Adding elevation gradient coloring and turn indicators makes this premium. |
| **Turn-by-turn voice navigation** | Most apps only do audio pace/distance callouts. Real turn-by-turn guidance ("turn left in 50 meters") is rare outside Google Maps. | Med | Already partially built. Off-route detection + re-routing guidance is the premium layer. |
| **Elevation gradient on route** | Color-coded route showing green (flat) to red (steep). Visually striking and informative. No running app does this well on a live map. | Med | Requires elevation data from OSRM or external DEM service. High visual impact. |
| **Off-route detection and guidance** | Alert when runner deviates > 50m with guidance to return. Rare in running apps (common in car nav). | Med | Continuous distance-to-polyline calculation. Must not be annoying (debounce alerts). |
| **Route regeneration (shuffle)** | Don't like the route? Tap to generate a new one. Instant variety. | Low | Already supported via multi-sample. Make the UX explicit with a "shuffle" button. |
| **Save and re-run favorite routes** | Build a personal library of tested routes. Load and go. | Med | IndexedDB storage. Distinguish from run history (routes vs completed runs). |
| **GPX export** | Let runners use generated routes on Garmin watches, import to Strava, share with non-app users. Bridge to the wider running ecosystem. | Med | Standard GPX XML format. Include waypoints and track. TCX format is a bonus for Garmin turn-by-turn. |
| **Route sharing via unique link** | Share a beautiful route with friends. Social acquisition channel. | Med | Requires server-side route storage (even a simple KV store). Shareable page with map preview. |
| **Remaining distance display** | Unique to loop-route apps. Runners on a generated route know exactly how far is left. Traditional apps cannot show this because they do not know the planned route. | Low | Simple: total route distance minus distance covered. High value, low effort. |
| **Split times per km** | Show pace for each completed kilometer. Runners use splits to evaluate consistency. | Med | Track GPS timestamps at each km boundary. Display in run summary and optionally live. |
| **Personal records auto-detection** | Automatically detect fastest 5K, 10K, half-marathon from run data. Motivating and expected in Strava/Garmin but a differentiator for a PWA. | Med | Scan completed run distances and times against standard race distances. |

## Anti-Features

Features to explicitly NOT build. Reasons documented.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Social feed / activity stream** | Strava owns social running. Building a social feed for a small PWA is a resource sink with no network effect. Users will post to Strava, not a new app. | GPX export and route sharing links let users bridge to Strava. |
| **Training plans / coaching** | Nike Run Club and Runna own guided training. Building AI coaching or structured plans is an entirely different product. RundLoop is about routes, not programs. | Keep focus on route generation and navigation. |
| **Instantaneous pace display** | GPS-derived instant pace fluctuates wildly (3:00 to 8:00 min/km within seconds). Runners find it useless and anxiety-inducing. | Use rolling lap pace: pace for the current kilometer being run. Smooth, useful, honest. |
| **Leaderboards / competitive segments** | Strava Segments are deeply entrenched. Competing here is futile and adds complexity. | Focus on personal records and personal progress, not competition. |
| **Calorie tracking as primary metric** | Calorie estimates from GPS data are wildly inaccurate without heart rate and VO2 data. Presenting them prominently is misleading. | Show estimated calories in run summary as a secondary stat with a disclaimer, not in the live display. |
| **Multi-sport support** | Cycling, swimming, hiking each need different UX, metrics, and routing. Dilutes the running focus. | Be the best running loop route app. Period. |
| **Music player integration** | Browser audio API limitations on iOS make this unreliable. Runners already have Spotify/Apple Music. Competing with their player creates friction. | Voice navigation coexists with background music apps natively. Do not try to control music. |
| **Ads of any kind** | PRD explicitly states "no ads, ever." Ads destroy the premium feel and trust. | Subscription model in Phase 3. Free tier is genuinely useful. |
| **Complex dashboard / data overload** | RUNALYZE-style analytics with boxplots and histograms overwhelm recreational runners. RundLoop targets casual-to-intermediate runners. | Simple weekly/monthly summaries, pace trend line, distance bar chart. Clean and glanceable. |
| **Heart rate zones without HR monitor** | Estimating heart rate from GPS data is not possible. Showing empty HR widgets frustrates users without Bluetooth monitors. | Add HR support only in Phase 2 when Web Bluetooth integration is built. Do not show HR UI until then. |

## Feature Dependencies

```
Route Generation (exists) --> Route Visualization (elevation colors, turn indicators)
Route Generation (exists) --> Route Preview (before-run map display, exists)
Route Generation (exists) --> GPX Export (serialize route to GPX XML)
Route Generation (exists) --> Route Sharing (store route, generate link)
Route Generation (exists) --> Save/Reuse Routes (persist to IndexedDB)

GPS Tracking (exists) --> Live Metrics (pace, distance, time)
GPS Tracking (exists) --> Off-route Detection (distance to polyline)
GPS Tracking (exists) --> Run Summary (GPS trace, actual stats)

Live Metrics --> Pause/Resume (freeze metrics state)
Live Metrics --> Split Times (track km boundaries)
Live Metrics --> Audio Milestones (trigger at distance thresholds)

Run Summary --> Run History (persist completed runs)
Run History --> Progress Analytics (aggregate over time)
Run History --> Personal Records (scan for bests)

Voice Navigation (exists) --> Off-route Alerts (spoken re-routing guidance)
Wake Lock API --> Keep Screen On (independent, no feature deps)
```

## MVP Recommendation

The PRD defines Phase 1 clearly. For the "polished running app" milestone, prioritize in this order:

**Must ship (table stakes that are missing or incomplete):**
1. **Live run metrics overlay** -- pace (rolling km), distance, elapsed time, remaining distance. Large fonts, high contrast. This is the most visible gap vs any real running app.
2. **Pause/resume functionality** -- without this, runners cannot stop at a traffic light without losing their run.
3. **Run summary screen** -- the reward moment. Distance, time, average pace, GPS trace on map, save/discard.
4. **Keep screen on (Wake Lock)** -- trivial to implement, critical for usability.
5. **Run history with persistence** -- IndexedDB. List view with date, distance, time, pace.

**Should ship (differentiators that justify using RundLoop):**
6. **Elevation gradient on route** -- the visual "wow" that makes screenshots shareable.
7. **Off-route detection** -- makes voice navigation actually reliable.
8. **Split times per km** -- expected by intermediate runners, shown in run summary.
9. **Route shuffle UX** -- make regeneration explicit and delightful.

**Defer to next milestone:**
- **GPX export** -- valuable but not needed for personal use phase. Phase 2.
- **Route sharing links** -- requires server-side storage. Phase 2.
- **Progress analytics / charts** -- needs sufficient run history data to be useful. Phase 2.
- **Personal records** -- needs run history. Phase 2.
- **Save/reuse routes** -- nice but runners can regenerate. Lower urgency than live metrics. Late Phase 1 or Phase 2.

## Platform Considerations (iOS Safari PWA)

These affect feature feasibility and must inform implementation:

| Concern | Impact | Mitigation |
|---------|--------|------------|
| GPS permission re-requested each session | Users must grant location permission every time they open the PWA from home screen | Clear onboarding UX explaining this. Cannot fix -- iOS limitation. |
| No background GPS when app is minimized | If runner switches to Spotify or checks a message, GPS tracking may pause | Wake Lock helps keep screen on. Warn users not to minimize during runs. Accumulate GPS gaps gracefully. |
| Service worker storage limits (iOS) | Tighter quotas than Chrome. IndexedDB may be purged after ~7 days of no use | Keep run data compact. Prompt users to export/backup. Phase 2 cloud sync solves this. |
| Web Speech API reliability | TTS quality varies by iOS version. May stop if audio session interrupted. | Graceful degradation. Never depend solely on voice -- always show visual turn indicators. |
| No Web Bluetooth on iOS Safari | Heart rate monitors cannot connect in PWA on iOS | Defer HR features entirely to Phase 2. Document as native-only or Android-only initially. |

## Sources

- Strava feature analysis: [Strava vs Nike Run Club comparison](https://vernekard.medium.com/strava-vs-nike-run-club-whats-the-best-running-app-a96fcc61bb94)
- Running app UX research: [Running Apps UX Research](https://fernandocomet.medium.com/running-apps-ux-research-7e07e41f556c)
- Strava vs Runkeeper: [competitive advantage comparison](https://www.advnture.com/features/strava-vs-runkeeper)
- PWA iOS limitations: [PWA iOS Limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- PWA iOS current status: [PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios)
- Loop route generation competitors: [RunGen app](https://apps.apple.com/us/app/rungen-create-running-routes/id1514017009), [Routeshuffle](https://routeshuffle.com/), [Loop Maps](https://apps.apple.com/us/app/loop-maps-my-run-route-planner/id6741156004)
- Running route planners overview: [Best Running Route Planners 2025](https://www.routific.com/blog/running-route-planner)
- GPX and Strava integration: [Strava GPX export](https://support.strava.com/hc/en-us/articles/216918437-Exporting-your-Data-and-Bulk-Export)
- Best running apps 2026: [Barbend best running apps](https://barbend.com/best-running-apps/)
- Pace display best practices: [LetsRun pace discussion](https://www.letsrun.com/forum/flat_read.php?thread=11843808)
