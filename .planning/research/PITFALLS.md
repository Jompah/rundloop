# Pitfalls Research

**Domain:** Mobile-first running PWA with GPS navigation, live metrics, and offline capability (iOS Safari primary target)
**Researched:** 2026-03-19
**Confidence:** HIGH (verified across multiple official sources, Apple developer forums, and community post-mortems)

## Critical Pitfalls

### Pitfall 1: iOS Safari Kills GPS Tracking When PWA Loses Focus

**What goes wrong:**
When a runner switches to another app (to change music, reply to a message, check the time via a notification), iOS suspends the PWA's JavaScript execution. The `watchPosition` callback stops firing. The runner returns to find a gap in their GPS trace, incorrect distance/pace calculations, and potentially a "lost" navigation state. Unlike native apps that can request "always on" location access, PWAs get zero background location updates.

**Why it happens:**
iOS does not grant PWAs background execution privileges. Service workers on iOS cannot process geolocation in the background. There is no `Background Sync` API support on iOS Safari. This is a fundamental platform limitation, not a bug.

**How to avoid:**
- Record timestamps with every GPS position. When the runner returns, detect the gap (timestamp delta > expected interval) and handle it explicitly: interpolate distance along the known route polyline, mark the gap in the GPS trace, and recalculate pace excluding the gap period.
- Use the Wake Lock API (supported since iOS 16.4+, fixed in standalone PWA mode in iOS 18.4) to keep the screen on during active navigation. This prevents the most common cause of focus loss: the screen auto-locking.
- Display a prominent warning before navigation starts: "Keep RundLoop visible during your run. Switching apps will pause GPS tracking."
- Store the active run state (current position index, elapsed time, distance) to IndexedDB every 10 seconds so state can be restored if the PWA is killed entirely.

**Warning signs:**
- GPS traces with straight-line segments between points (teleportation artifacts)
- Distance calculations that are significantly shorter than the route distance
- Users reporting "the app lost my run"

**Phase to address:**
Phase 1 (GPS Navigation polish) -- this must be solved before any real-world testing. Build gap detection and state persistence into the core navigation loop from day one.

---

### Pitfall 2: Raw GPS Data Creates Unusable Run Metrics

**What goes wrong:**
Browser Geolocation API returns raw GPS positions with accuracy ranging from 3m to 65m+ depending on conditions (urban canyons, tree cover, clouds). Without filtering, the runner's position jitters constantly. Distance accumulates from GPS noise alone -- a runner standing still can "run" 200-500m in 10 minutes. Pace calculations swing wildly between 2:00/km and 15:00/km. Off-route detection fires false positives constantly.

**Why it happens:**
Developers treat `watchPosition` output as ground truth. Native running apps (Strava, Runkeeper, Nike Run Club) all apply significant post-processing: Kalman filtering, accuracy-based rejection, speed sanity checks, and snap-to-route algorithms. A PWA that skips this processing feels broken by comparison.

**How to avoid:**
- Reject positions with `accuracy > 25m` entirely (the current code accepts all positions).
- Implement a simple 1D Kalman filter for both latitude and longitude streams. The `kalmanjs` library is lightweight and dependency-free.
- Apply speed sanity checks: reject positions that imply speed > 25 km/h (impossibly fast for running) or positions that imply the runner teleported backward along the route.
- Snap the displayed position to the nearest point on the route polyline when the runner is within 30m of the route. This makes navigation feel smooth and eliminates visual jitter.
- Calculate distance using the route polyline progression (how far along the planned route), not raw point-to-point GPS distance. This gives stable, predictable distance readings.
- Smooth pace display with a rolling average over 20-30 seconds, not instantaneous calculation.

**Warning signs:**
- Distance readings that increase while the runner is stationary (test by leaving phone on a table)
- Pace display flickering rapidly between extreme values
- Position dot visually jumping around on the map

**Phase to address:**
Phase 1 (Live Run Metrics) -- GPS filtering must be implemented before metrics are meaningful. Build a `GPSFilter` class that sits between `watchPosition` and the rest of the app.

---

### Pitfall 3: Web Speech API Silently Fails on iOS Safari

**What goes wrong:**
Voice navigation works in development, then fails silently in production on iOS Safari. The `speechSynthesis.speak()` call appears to succeed (no error thrown) but produces no audio. This happens because: (1) iOS requires a user gesture to "unlock" the audio context before any speech can play, (2) `speechSynthesis.getVoices()` returns an empty array on first call in Safari -- voices load asynchronously, (3) speech synthesis stops working entirely if the browser was backgrounded and returned to foreground, (4) long utterances are silently truncated.

**Why it happens:**
Apple's WebKit implements Web Speech API with stricter security policies than Chrome. The API surface looks identical but the behavior diverges significantly. Developers test in Chrome on desktop, ship, and discover it does not work on the target device.

**How to avoid:**
- Trigger a silent `speechSynthesis.speak(new SpeechSynthesisUtterance(''))` on the first user tap (e.g., the "Start Run" button) to unlock the audio context.
- Listen for the `voiceschanged` event before accessing voices: `speechSynthesis.addEventListener('voiceschanged', () => { /* now getVoices() works */ })`.
- Keep utterances short (under 200 characters). Split longer navigation instructions into separate utterances.
- After any app focus/visibility change, call `speechSynthesis.cancel()` followed by a fresh `speak()` call to reset the synthesis engine.
- Implement a fallback: if `speechSynthesis` is unavailable or fails, use the Web Audio API to play pre-recorded audio clips for the most critical cues (turn left, turn right, milestone).
- Test exclusively on a real iPhone in standalone PWA mode. The iOS Simulator and desktop Safari do not reproduce these bugs.

**Warning signs:**
- Voice navigation works in Chrome DevTools mobile emulation but not on real iPhone
- Voice works on first run but stops after locking/unlocking the phone
- No errors in console despite no audio output

**Phase to address:**
Phase 1 (GPS Navigation polish) -- voice navigation is a core navigation feature. Must be tested on real hardware early and often.

---

### Pitfall 4: iOS Safari Evicts PWA Storage After 7 Days of Inactivity

**What goes wrong:**
A runner who uses the app weekly (common pattern: weekend runner) opens the app to find all their run history, saved routes, and settings have been deleted. iOS Safari's Intelligent Tracking Prevention (ITP) deletes all script-writable storage (IndexedDB, localStorage, Cache API) for origins that have not had user interaction in the last 7 days of browser use.

**Why it happens:**
Apple's ITP treats PWA storage as expendable to combat cross-site tracking. The 7-day eviction applies to all origins without distinction. This is documented in WebKit's storage policy updates. The eviction happens silently -- no warning, no callback, no event.

**How to avoid:**
- Call `navigator.storage.persist()` on app launch. If granted, the origin's storage is exempt from automatic eviction. iOS Safari 17+ supports this API. Display a prompt explaining why persistent storage matters.
- Design all storage operations to handle empty/missing data gracefully. Never assume data exists -- always check and degrade gracefully.
- For Phase 2+, sync run history to Supabase. Local storage should be treated as a cache of cloud data, not the source of truth.
- Show users their storage status: `navigator.storage.estimate()` can reveal quota and usage. If persistence was denied, warn the user that data may be lost.

**Warning signs:**
- Users on forums reporting "the app deleted my runs"
- Storage checks returning empty on app launch despite previous saves
- Complaints clustering around Monday/Tuesday (weekend runners returning after 7+ days)

**Phase to address:**
Phase 1 (Run History with IndexedDB) -- must request persistent storage and handle eviction gracefully. Phase 2 (Supabase sync) eliminates this as a concern for logged-in users.

---

### Pitfall 5: OSRM Public Demo Server Is Not Production-Ready

**What goes wrong:**
Route generation works during development but becomes unreliable when real users start using the app. The OSRM public API at `router.project-osrm.org` returns 503 errors during peak hours, has no SLA, enforces rate limits (512 requests per persistent connection, max 5 seconds between requests), and explicitly states it is for "light testing only" with "no quality guarantees."

The binary search distance calibration in RundLoop makes 3-8 OSRM requests per route generation. With multi-sample retry, a single user generating a route can make 24+ API calls. At 10 concurrent users, that is 240+ requests in rapid succession.

**Why it happens:**
The public OSRM API is a community resource, not a commercial service. Its documentation explicitly recommends self-hosting for production use. Developers prototype against it and never migrate.

**How to avoid:**
- Self-host OSRM with the foot profile. A minimal OSRM instance for a single country (Sweden) runs comfortably on a 2GB RAM VPS (~$5-10/month). Pre-process the Sweden OSM extract with the foot profile.
- Alternatively, use a commercial routing API with an SLA (Mapbox Directions, Google Routes API, or Valhalla hosted on a VPS). Mapbox offers 100,000 free requests/month.
- Implement request caching: if the same start point and distance were requested recently, serve cached routes before hitting the API.
- Add circuit breaker logic: if OSRM returns errors 3 times in a row, show a user-friendly error and offer to retry later rather than hanging indefinitely.

**Warning signs:**
- Route generation taking > 15 seconds intermittently
- 503/timeout errors in server logs
- Users reporting "route generation failed" without clear pattern

**Phase to address:**
Phase 1 (before real-world testing with multiple users). Must be resolved before Phase 2 public launch -- the public API will not scale.

---

### Pitfall 6: Map Rendering Drains Battery During Active Navigation

**What goes wrong:**
MapLibre GL JS uses WebGL for GPU-accelerated rendering. During navigation, the map is continuously re-rendered as the runner moves: updating position, rotating the map to heading, panning to follow. On a 1-2 hour run, this continuous GPU usage combined with high-accuracy GPS polling drains 30-50% battery, far exceeding the 15% per hour target in the PRD.

**Why it happens:**
MapLibre triggers a full re-render on every frame when the map is moving or animating. The `requestAnimationFrame` loop runs at 60fps even when only the position marker has moved. Combined with `enableHighAccuracy: true` GPS polling (which activates the GPS radio at maximum power), the cumulative power draw is substantial.

**How to avoid:**
- Reduce map re-render frequency during navigation. Update position on the map at most every 2-3 seconds, not on every GPS callback. Use CSS transforms to animate the position marker between map updates.
- Set `map.setMaxFPS(30)` during navigation. Runners cannot perceive the difference between 30fps and 60fps while glancing at their phone.
- Avoid continuous map rotation animation. Snap heading changes rather than smoothly animating them. Smooth rotation triggers continuous rendering.
- Use raster tiles (which RundLoop already does), not vector tiles. Raster tiles are pre-rendered and require less GPU processing.
- Consider a "minimal mode" for long runs: simplified map with just the route line and position dot, no labels or POIs.
- Reduce `maximumAge` in `watchPosition` options from the current 5000ms to 3000ms for navigation accuracy but increase it to 10000ms when the runner is clearly on-route and no turns are approaching.

**Warning signs:**
- Battery monitoring during test runs shows > 20% drain per hour
- Phone getting physically warm during navigation
- Users reporting they need to charge mid-run

**Phase to address:**
Phase 1 (GPS Navigation) -- battery optimization must be validated with real test runs of 30+ minutes before considering the navigation feature complete.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing API keys in client-side code | Faster development | Security breach, API key theft, billing abuse | Never -- the PRD explicitly requires server-side keys via API routes |
| Using `localStorage` instead of IndexedDB for run data | Simpler API, synchronous | 5MB limit, blocks main thread on large reads, no structured queries | Only for small config (settings, preferences) |
| Skipping GPS filtering ("raw positions are fine for now") | Ship faster | Unusable metrics, false off-route alerts, user trust destroyed | Never -- unfiltered GPS is not an MVP, it is broken |
| Hardcoding OSRM public API URL | No infrastructure to manage | Production failures at scale, no fallback | Only for initial prototype (already past this stage) |
| Not implementing run state persistence | Less code | Lost runs when app is killed mid-run | Never -- this is the user's workout data |
| Polling GPS at maximum frequency continuously | Simplest implementation | 2x battery drain vs. adaptive polling | Only during initial development testing |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OSRM foot routing | Assuming public API is reliable for production | Self-host or use commercial API. Cache aggressively. Implement circuit breaker. |
| Web Speech API (iOS) | Not unlocking audio context with user gesture | Call `speechSynthesis.speak('')` on first user tap. Listen for `voiceschanged` event. |
| Geolocation API (iOS PWA) | Expecting persistent permission grant | Design for re-prompting each session. Test permission flow in standalone mode on real device. |
| Wake Lock API | Assuming it prevents all screen-off scenarios | Wake Lock is released when user switches apps or when battery is low. Handle `release` event. Re-acquire lock on visibility change. |
| MapLibre GL JS | Loading full tile set for navigation view | Use `map.fitBounds()` to the route corridor. Cancel tile loads for previous zoom levels. Set reasonable `maxZoom` (16 is sufficient for running). |
| IndexedDB on iOS | Assuming data persists indefinitely | Request `navigator.storage.persist()`. Handle empty storage gracefully. Sync to cloud when available. |
| Nominatim reverse geocoding | Not setting User-Agent header | Nominatim requires a valid User-Agent. The current code correctly sets this, but rate limits apply (1 req/sec). |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Storing full GPS trace as a single IndexedDB record | Slow writes during run, UI freezes on history load | Write GPS points in batches (every 30 points). Store traces in chunks, load lazily. | Runs > 1 hour (1000+ points) |
| Re-rendering entire route polyline on every position update | Dropped frames, janky map | Separate route layer (static) from position layer (dynamic). Only update position marker. | Immediately on low-end devices |
| Calculating distance by summing GPS point-to-point distances | Distance inflated by GPS noise | Use route polyline progression. Sum filtered points only. | Always -- GPS noise adds 5-20% phantom distance |
| Loading all run history records on app launch | Slow startup, wasted memory | Paginate history. Load summaries first, full data on demand. | 50+ saved runs |
| Continuous OSRM requests during binary search calibration without timeout | Route generation hangs, user waits indefinitely | Set 8-second timeout per OSRM request. Abort after 3 failures. Show progress to user. | When OSRM is under load |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Claude API key in client-side bundle | Unlimited API usage billed to your account | Use Next.js API routes exclusively. Verify with `NEXT_PUBLIC_` prefix check -- if your API key starts with this prefix, it is exposed. |
| Storing user location history without consent clarity | GDPR violation (Sweden/EU), fines up to 4% of revenue | Show clear privacy notice before first GPS tracking. Provide data export and deletion. All location data stays on-device in Phase 1. |
| Using HTTP for OSRM API calls | Location data intercepted in transit | Ensure all external API calls use HTTPS. The current OSRM URL should be verified. |
| Not rate-limiting the route generation API endpoint | Abuse/cost explosion from automated requests | Add rate limiting to `/api/` routes. Use Vercel Edge Middleware or simple in-memory rate limiter. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw pace numbers without smoothing | Runner sees 3:30/km then 8:00/km then 4:15/km in rapid succession. Feels broken. | 20-30 second rolling average. Only update display every 5 seconds. |
| Small touch targets during active run | Runner with sweaty fingers cannot tap pause/mute. Frustration mid-run. | Minimum 48x48px touch targets. Consider 64px+ for primary actions during navigation. |
| No confirmation before ending a run | Accidental tap ends the run and loses data. | Confirmation dialog with large buttons. Require deliberate action (long press or two-step). |
| Showing too much data while running | Information overload. Runner cannot process 6 metrics while moving. | Show 3 metrics max during run (pace, distance, time). Additional metrics on tap/swipe. |
| Map consuming entire screen during navigation | Runner cannot see metrics and map simultaneously. | Split view: map top 60%, metrics bar bottom 40%. Metrics always visible without scrolling. |
| Off-route alerts firing in tunnels or GPS-poor areas | False alarms erode trust. Runner ignores real off-route warnings. | Require 3 consecutive off-route positions before alerting. Suppress alerts when GPS accuracy > 30m. |

## "Looks Done But Isn't" Checklist

- [ ] **GPS Navigation:** Often missing gap detection when app loses focus -- verify by switching to Music app mid-run and returning after 30 seconds
- [ ] **Voice Navigation:** Often missing iOS audio unlock -- verify by testing on real iPhone in standalone PWA mode with phone previously locked
- [ ] **Run Metrics:** Often missing GPS noise filtering -- verify by leaving phone stationary for 5 minutes and checking if distance increases
- [ ] **Wake Lock:** Often missing re-acquisition after visibility change -- verify by receiving a notification during navigation and checking if screen stays on after dismissing it
- [ ] **Off-route Detection:** Often missing accuracy-aware thresholds -- verify in areas with poor GPS (near tall buildings) and confirm no false alerts
- [ ] **Run History:** Often missing storage eviction handling -- verify by clearing Safari data and reopening the PWA
- [ ] **Service Worker:** Often missing cache invalidation strategy -- verify by deploying an update and checking if existing PWA installs receive it
- [ ] **Route Generation:** Often missing timeout/error handling for OSRM -- verify by testing with airplane mode toggled during generation
- [ ] **Dark Mode:** Often missing proper contrast on all states (disabled buttons, error states, loading skeletons) -- verify with AA contrast checker on every screen state
- [ ] **Pause/Resume:** Often missing state persistence through app kill -- verify by force-quitting the PWA mid-run and reopening

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| GPS trace gaps from backgrounding | LOW | Interpolate along route polyline. Mark interpolated segments visually. Adjust distance/pace to exclude gap. |
| Storage eviction (lost run history) | HIGH | Cannot recover deleted data. Prevention is the only option (persistent storage + cloud sync). |
| OSRM public API failure at scale | MEDIUM | Switch to self-hosted OSRM or commercial API. Requires infrastructure setup (~1 day). Cache existing routes. |
| Voice nav failure on iOS | LOW | Implement audio file fallback for critical cues. Can be added as a patch without architecture changes. |
| Battery drain exceeding targets | MEDIUM | Reduce map FPS, increase GPS polling interval, add minimal navigation mode. Requires real-device profiling and iterative tuning. |
| Unfiltered GPS causing inflated distances | MEDIUM | Retrofit Kalman filter and accuracy rejection. Requires recalculating any already-stored run distances. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| GPS background suspension | Phase 1: Navigation Polish | 30-min test run with app-switching. Verify gap detection and state recovery. |
| Raw GPS noise | Phase 1: Live Metrics | 5-min stationary test shows < 10m phantom distance. Pace stable within 10% on steady run. |
| Web Speech API iOS failures | Phase 1: Navigation Polish | Voice nav works on real iPhone in standalone PWA mode after screen lock/unlock cycle. |
| Storage eviction | Phase 1: Run History | `navigator.storage.persist()` called. App handles empty storage without crashing. |
| OSRM reliability | Phase 1: Pre-launch / Phase 2: Public Launch | Self-hosted OSRM or commercial API with SLA. Circuit breaker tested. |
| Battery drain | Phase 1: Navigation Polish | Real-device test: < 15% battery drain per hour during 30-min navigation session. |
| EU PWA restrictions (future risk) | Phase 2: Public Launch | Monitor Apple developer announcements. Have Capacitor wrapper as contingency plan. |
| GDPR compliance for location data | Phase 1: Privacy notice | Clear consent flow before first GPS use. Data export/deletion available. |

## Sources

- [PWA iOS Limitations and Safari Support 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) -- comprehensive overview of current iOS PWA limitations
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) -- official Apple documentation on 7-day storage eviction and persistent storage
- [Wake Lock API Bug in Home Screen Web Apps (WebKit Bugzilla)](https://bugs.webkit.org/show_bug.cgi?id=254545) -- documents the Wake Lock PWA standalone bug (fixed in iOS 18.4)
- [The State of Speech Synthesis in Safari](https://weboutloud.io/bulletin/speech_synthesis_in_safari/) -- iOS Safari SpeechSynthesis quirks and workarounds
- [OSRM API Usage Policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy) -- public API is for testing only, not production
- [MapLibre Performance Optimization (GitHub Issue #96)](https://github.com/maplibre/maplibre-gl-js/issues/96) -- CPU/GPU intensive re-rendering issues
- [MDN Storage Quotas and Eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- browser storage quota documentation
- [KalmanJS](https://github.com/wouterbulten/kalmanjs) -- lightweight Kalman filter for GPS noise reduction
- [PWA Bugs Repository](https://github.com/PWA-POLICE/pwa-bugs) -- community-maintained list of PWA bugs and workarounds
- [Apple Developer Forums: Geolocation in PWA](https://developer.apple.com/forums/thread/694999) -- location permission issues in standalone mode

---
*Pitfalls research for: RundLoop -- mobile-first running PWA with GPS navigation*
*Researched: 2026-03-19*
