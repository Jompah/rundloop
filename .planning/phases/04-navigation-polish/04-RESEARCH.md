# Phase 4: Navigation Polish - Research

**Researched:** 2026-03-20
**Domain:** Map rotation, off-route detection, voice milestones, iOS Safari PWA audio
**Confidence:** HIGH

## Summary

Phase 4 adds four capabilities to the existing navigation: (1) map auto-rotation following the runner's heading with tilt, (2) off-route detection with multi-sensory alerts and return guidance, (3) voice distance milestone cues with configurable styles, and (4) iOS Safari audio context unlocking for PWA mode. The existing codebase provides strong foundations -- MapLibre GL JS 5.20.2 already supports `easeTo({ bearing, pitch })`, the `GeoPosition` type already carries `heading`, and `voice.ts` wraps the Web Speech API. The main work is threading heading through `FilteredPosition`, building the point-to-segment distance calculation, and handling iOS Safari speechSynthesis quirks.

**Primary recommendation:** Build navigation logic as pure utility functions (heading smoothing, point-to-segment distance, milestone detection, compass direction) that are easy to unit test, then wire them into existing components. Keep iOS audio unlock as a surgical change in `voice.ts` triggered on the "Start Run" button tap.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Map rotates smoothly via `map.easeTo({ bearing })` on each GPS update during active navigation
- Slight 30 degree pitch (tilt) during navigation for forward-looking perspective like car GPS
- If heading is null, fall back to calculated bearing from last 2 GPS points
- Manual interaction (pan/zoom) disables auto-rotation; "re-center" button re-enables it
- Custom point-to-segment distance calculation (no new dependency like turf.js) -- iterate route segments, find nearest point
- Alert via banner at top of screen + haptic vibration + voice announcement -- multi-sensory for runners
- Return guidance: "Off route -- head [direction] to rejoin" with compass direction (N/NE/E/SE/S/SW/W/NW)
- Check deviation every GPS tick (computationally cheap)
- Deviation threshold: 50m from route triggers alert
- Announce every whole km milestone (1, 2, 3...) plus halfway point
- Three configurable voice styles: concise, with-pace, motivational
- iOS Safari audio context unlocked via silent `speechSynthesis.speak("")` on first user gesture (run start button tap)
- Milestone announcements respect user's km/miles unit preference from settings

### Claude's Discretion
- Off-route banner visual design (colors, animation, positioning)
- Exact heading smoothing algorithm (if needed to reduce jitter)
- Settings UI layout for voice style selection
- Re-center button placement and visual design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | Map auto-rotates to follow runner's heading during active navigation | MapLibre `easeTo({ bearing, pitch })` confirmed; heading available in GeoPosition; needs threading into FilteredPosition |
| NAV-02 | Off-route detection alerts runner when deviating >50m with guidance to return | Point-to-segment distance algorithm documented; compass direction calculation straightforward |
| NAV-03 | Distance milestone voice cues ("1 kilometer completed", "Halfway point") | Milestone detection from distanceMeters in useRunSession; voice styles stored in settings |
| NAV-04 | Option to mute/unmute voice navigation without stopping the run | Already implemented in RunMetricsOverlay voice toggle; milestones must respect same voiceEnabled flag |
| NAV-05 | Voice navigation works reliably on iOS Safari (user-gesture audio unlock, post-background reset) | Silent speak on gesture unlocks iOS audio; cancel+re-speak pattern handles background resume |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | 5.20.2 | Map rendering, camera control | Already in use; `easeTo` supports bearing+pitch natively |
| Web Speech API (SpeechSynthesis) | Browser built-in | Voice announcements | Already wrapped in `voice.ts`; no external dependency |
| Geolocation API | Browser built-in | Heading data from `coords.heading` | Already captured in `GeoPosition` type |
| Vibration API | Browser built-in | Haptic feedback for off-route alerts | Already used for step changes in NavigationView |

### Supporting (no new dependencies)
No new packages required. All functionality uses browser APIs and custom utility functions per user decision (no turf.js).

### Alternatives Considered
| Instead of | Could Use | Why NOT Using |
|------------|-----------|---------------|
| Custom point-to-segment | turf.js nearestPointOnLine | User locked decision: no new dependency |
| Custom heading smoothing | geolocation-utils | Small utility not worth a dependency |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    navigation.ts          # Pure functions: pointToSegmentDistance, nearestSegmentIndex, isOffRoute, getCompassDirection, smoothHeading
    milestones.ts          # Pure functions: detectMilestone, formatMilestoneMessage
    voice.ts               # Existing + unlockIOSAudio(), speakMilestone()
  types/
    index.ts               # FilteredPosition gains heading field; AppSettings gains voiceStyle field
  components/
    MapView.tsx            # Gains heading/bearing prop, auto-rotation logic, interaction detection
    NavigationView.tsx     # Gains off-route banner, milestone announcements
    OffRouteBanner.tsx     # New: off-route alert banner component
    SettingsView.tsx       # Gains voice style selector
```

### Pattern 1: Pure Navigation Utilities
**What:** All navigation math (distance, heading, compass) as pure exported functions in `navigation.ts`
**When to use:** Every GPS tick processes through these
**Example:**
```typescript
// src/lib/navigation.ts

/**
 * Shortest distance from a point to a line segment (in meters).
 * Uses projected point-on-segment in approximate local coordinates.
 */
export function pointToSegmentDistance(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  // Convert to approximate meters using equirectangular projection
  const cosLat = Math.cos((pLat * Math.PI) / 180);
  const px = (pLng - aLng) * cosLat;
  const py = pLat - aLat;
  const ax = 0;
  const ay = 0;
  const bx = (bLng - aLng) * cosLat;
  const by = bLat - aLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  }

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  const distDeg = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  // Convert degree-distance to meters (1 degree latitude ~= 111,320m)
  return distDeg * 111320;
}

/**
 * Find minimum distance from point to any segment in polyline.
 */
export function distanceToRoute(
  lat: number, lng: number,
  polyline: [number, number][]  // [lng, lat] pairs
): number {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLng, aLat] = polyline[i];
    const [bLng, bLat] = polyline[i + 1];
    const d = pointToSegmentDistance(lat, lng, aLat, aLng, bLat, bLng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * 8-point compass direction from current position to target.
 */
export function getCompassDirection(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): string {
  const dLat = toLat - fromLat;
  const dLng = (toLng - fromLng) * Math.cos((fromLat * Math.PI) / 180);
  const angle = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(angle / 45) % 8];
}

/**
 * Simple exponential moving average for heading smoothing.
 */
export function smoothHeading(
  current: number | null,
  previous: number | null,
  alpha: number = 0.3
): number | null {
  if (current === null) return previous;
  if (previous === null) return current;
  // Handle wrap-around at 0/360
  let diff = current - previous;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return ((previous + alpha * diff) + 360) % 360;
}
```

### Pattern 2: Milestone Detection as Pure Function
**What:** Track which milestones have been announced, detect new ones
**When to use:** Every distance update checks for new milestones
**Example:**
```typescript
// src/lib/milestones.ts
export type VoiceStyle = 'concise' | 'with-pace' | 'motivational';

export interface MilestoneEvent {
  type: 'distance' | 'halfway';
  distanceValue: number;  // in user units (km or miles)
}

export function detectMilestone(
  prevDistanceMeters: number,
  currentDistanceMeters: number,
  routeDistanceMeters: number,
  units: 'km' | 'miles',
  announcedMilestones: Set<string>
): MilestoneEvent | null {
  const divisor = units === 'miles' ? 1609.34 : 1000;
  const prevUnits = Math.floor(prevDistanceMeters / divisor);
  const currentUnits = Math.floor(currentDistanceMeters / divisor);

  // Whole km/mile milestone
  if (currentUnits > prevUnits && currentUnits > 0) {
    const key = `distance-${currentUnits}`;
    if (!announcedMilestones.has(key)) {
      announcedMilestones.add(key);
      return { type: 'distance', distanceValue: currentUnits };
    }
  }

  // Halfway milestone
  const halfwayKey = 'halfway';
  if (
    !announcedMilestones.has(halfwayKey) &&
    routeDistanceMeters > 0 &&
    prevDistanceMeters < routeDistanceMeters / 2 &&
    currentDistanceMeters >= routeDistanceMeters / 2
  ) {
    announcedMilestones.add(halfwayKey);
    return { type: 'halfway', distanceValue: currentDistanceMeters / divisor };
  }

  return null;
}

export function formatMilestoneMessage(
  event: MilestoneEvent,
  style: VoiceStyle,
  units: 'km' | 'miles',
  avgPaceFormatted?: string
): string {
  const unitLabel = units === 'miles' ? 'mile' : 'kilometer';
  const plural = event.distanceValue !== 1 ? 's' : '';

  if (event.type === 'halfway') {
    switch (style) {
      case 'concise': return 'Halfway point';
      case 'with-pace': return `Halfway point. Average pace: ${avgPaceFormatted ?? '--:--'} per ${unitLabel}`;
      case 'motivational': return 'Great work! You are halfway there!';
    }
  }

  switch (style) {
    case 'concise':
      return `${event.distanceValue} ${unitLabel}${plural} completed`;
    case 'with-pace':
      return `${event.distanceValue} ${unitLabel}${plural} completed. Average pace: ${avgPaceFormatted ?? '--:--'} per ${unitLabel}`;
    case 'motivational':
      return `Great work! ${event.distanceValue} ${unitLabel}${plural} done`;
  }
}
```

### Pattern 3: Map Auto-Rotation with Interaction Override
**What:** Track whether user has manually interacted with map; if so, disable auto-rotation until re-center pressed
**When to use:** Navigation mode in MapView
**Example:**
```typescript
// Inside MapView.tsx -- conceptual pattern
const isAutoRotating = useRef(true);

// Detect manual interaction
useEffect(() => {
  if (!mapRef.current || !isNavigating) return;
  const map = mapRef.current;

  const onInteraction = () => { isAutoRotating.current = false; };
  map.on('dragstart', onInteraction);
  map.on('zoomstart', onInteraction);

  return () => {
    map.off('dragstart', onInteraction);
    map.off('zoomstart', onInteraction);
  };
}, [isNavigating]);

// Auto-rotate on GPS update
useEffect(() => {
  if (!mapRef.current || !isNavigating || !isAutoRotating.current) return;
  if (heading === null && !userLocation) return;

  mapRef.current.easeTo({
    center: userLocation!,
    bearing: heading ?? 0,
    pitch: 30,
    zoom: 16,
    duration: 500,
  });
}, [userLocation, heading, isNavigating]);

// Re-center button resets auto-rotation
const handleRecenter = () => {
  isAutoRotating.current = true;
};
```

### Pattern 4: iOS Audio Unlock
**What:** Call `speechSynthesis.speak("")` with empty/silent utterance on user gesture to unlock audio context
**When to use:** On "Start Run" button click, before any voice announcements
**Example:**
```typescript
// src/lib/voice.ts addition
let iosUnlocked = false;

export function unlockIOSAudio(): void {
  if (iosUnlocked) return;
  const s = getSynth();
  if (!s) return;

  // Silent utterance to unlock iOS audio context
  const utterance = new SpeechSynthesisUtterance('');
  utterance.volume = 0;
  s.speak(utterance);
  iosUnlocked = true;
}

// Also add: re-initialize after background
export function ensureSpeechReady(): void {
  const s = getSynth();
  if (!s) return;
  // iOS Safari breaks speechSynthesis after backgrounding.
  // Cancel any stuck state and re-speak to reset.
  s.cancel();
}
```

### Anti-Patterns to Avoid
- **Mutating polyline coordinates:** Route polyline is `[lng, lat]` but haversine expects `(lat, lng)`. Always destructure explicitly.
- **Re-creating Map instance on heading change:** Use `easeTo()` on the existing map, never tear down and rebuild.
- **Polling for off-route:** Do not use setInterval. Check on every GPS tick (already event-driven).
- **Stateful voice style in voice.ts:** Keep voice.ts stateless. Pass style from settings at call site.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Haversine distance | Another inline copy | Import from `storage.ts` which already exports `haversineMeters` | 4 copies exist already; consolidate |
| Map camera animation | Custom requestAnimationFrame loop | `map.easeTo()` built into MapLibre | Handles easing, cancellation, frame timing |
| Speech synthesis | Custom AudioContext + audio generation | Browser SpeechSynthesis API (already wrapped) | Reliable, zero-dependency, voice selection handled by browser |

**Key insight:** The user explicitly decided no turf.js, so the point-to-segment calculation MUST be hand-rolled. Keep it as a pure function with thorough unit tests. The equirectangular projection approximation is accurate enough at running-distance scales (< 50km).

## Common Pitfalls

### Pitfall 1: Coordinate Order Confusion
**What goes wrong:** MapLibre uses `[lng, lat]` but haversine/geo calculations expect `(lat, lng)`. Mixing them produces wildly wrong distances.
**Why it happens:** The polyline in `GeneratedRoute` is `[lng, lat][]`. GPS positions have `.lat` and `.lng` as separate fields.
**How to avoid:** Always destructure polyline points with explicit naming: `const [lng, lat] = polyline[i]`. Never pass a polyline point directly as lat/lng args.
**Warning signs:** Distance calculations returning values in the millions of meters, or off-route detection triggering immediately.

### Pitfall 2: iOS Safari speechSynthesis Breaking After Background
**What goes wrong:** If the app goes to background while speaking, speechSynthesis enters a broken state and silently fails on subsequent `speak()` calls.
**Why it happens:** iOS Safari kills the audio session on background transition. The SpeechSynthesis object persists but becomes non-functional.
**How to avoid:** On visibilitychange event (document becomes visible again), call `speechSynthesis.cancel()` to reset state. The next `speak()` call will work normally.
**Warning signs:** Voice announcements stop working mid-run after the runner switches apps or locks phone.

### Pitfall 3: Heading Jitter at Low Speed
**What goes wrong:** GPS heading values oscillate wildly when the runner is standing still or moving slowly (< 1 m/s).
**Why it happens:** GPS heading is derived from position delta and becomes noisy at low speeds.
**How to avoid:** Only update bearing when `speed > 1.0 m/s`. Use exponential moving average (alpha ~0.3) to smooth heading transitions.
**Warning signs:** Map spinning erratically when runner stops at a traffic light.

### Pitfall 4: Re-center Button Must Reset Both Center AND Rotation
**What goes wrong:** Re-center button only centers the map but doesn't resume auto-rotation, so the map stays at the manually-set bearing.
**Why it happens:** Forgetting to reset the `isAutoRotating` flag.
**How to avoid:** Re-center handler must set `isAutoRotating.current = true` AND trigger an immediate `easeTo` with current bearing.

### Pitfall 5: Off-Route Alert Spam
**What goes wrong:** Runner gets repeated alert every GPS tick while off-route.
**Why it happens:** No cooldown or "already alerted" state.
**How to avoid:** Track `isCurrentlyOffRoute` state. Only announce once when transitioning from on-route to off-route. Optionally repeat every 30s if still off-route.

### Pitfall 6: Settings Async Loading Race
**What goes wrong:** SettingsView currently calls `getSettings()` synchronously but it's async (returns Promise).
**Why it happens:** SettingsView.tsx line 12: `useState<AppSettings>(getSettings())` -- this passes a Promise as initial state, not the resolved value.
**How to avoid:** This is a pre-existing bug. Fix it when adding voiceStyle: use useEffect + async load pattern (already correct in NavigationView).

## Code Examples

### Heading Threading Through FilteredPosition
```typescript
// src/types/index.ts -- add heading field
export interface FilteredPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
  heading: number | null;  // NEW: compass heading in degrees (0=north, 90=east)
}

// src/lib/gps-filter.ts -- preserve heading from raw GeoPosition
const filtered: FilteredPosition = {
  lat: pos.lat,
  lng: pos.lng,
  accuracy: pos.accuracy,
  timestamp: pos.timestamp,
  speed: pos.speed,
  heading: pos.heading,  // NEW: pass through from GeoPosition
};
```

### Off-Route Detection Integration
```typescript
// In NavigationView.tsx or a custom hook
const [offRoute, setOffRoute] = useState(false);
const [offRouteDirection, setOffRouteDirection] = useState<string>('');
const offRouteAnnouncedRef = useRef(false);

useEffect(() => {
  if (!userLocation || runStatus !== 'active') return;

  const dist = distanceToRoute(
    userLocation[1],  // lat
    userLocation[0],  // lng
    route.polyline
  );

  const isOff = dist > 50;

  if (isOff && !offRouteAnnouncedRef.current) {
    // Find nearest point on route for return guidance
    const nearestIdx = findNearestSegmentIndex(userLocation[1], userLocation[0], route.polyline);
    const [targetLng, targetLat] = route.polyline[nearestIdx];
    const direction = getCompassDirection(userLocation[1], userLocation[0], targetLat, targetLng);

    setOffRoute(true);
    setOffRouteDirection(direction);
    offRouteAnnouncedRef.current = true;

    // Multi-sensory alert
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    speak(`Off route. Head ${direction} to rejoin.`, settings.voiceEnabled);
  } else if (!isOff) {
    if (offRouteAnnouncedRef.current) {
      setOffRoute(false);
      offRouteAnnouncedRef.current = false;
    }
  }
}, [userLocation, runStatus]);
```

### AppSettings Type Extension
```typescript
// src/types/index.ts
export interface AppSettings {
  apiProvider?: 'claude' | 'perplexity';
  apiKey?: string;
  voiceEnabled: boolean;
  voiceStyle: 'concise' | 'with-pace' | 'motivational';  // NEW
  units: 'km' | 'miles';
  defaultDistance: number;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `navigator.compass` | `coords.heading` in Geolocation API | Years ago | Heading comes from GPS, not magnetometer; works without compass hardware |
| Audio.play() for TTS | SpeechSynthesis API | Stable | No audio files needed; real-time text-to-speech |
| mapbox-gl `rotateTo` | maplibre-gl `easeTo({ bearing })` | MapLibre v2+ | Single call handles bearing + pitch + center |

**Deprecated/outdated:**
- `speechSynthesis.getVoices()` on Safari: Returns empty array. Do not rely on voice selection on iOS Safari. Let the browser pick the default voice.

## Open Questions

1. **iOS Safari background speech recovery completeness**
   - What we know: `speechSynthesis.cancel()` on visibilitychange resets the broken state. Next `speak()` works.
   - What's unclear: Whether this works 100% in standalone PWA mode vs. Safari tab mode.
   - Recommendation: Implement cancel-on-visibility-change. Test manually on real iPhone. Add a fallback that re-unlocks audio if speech fails.

2. **Heading availability on iOS in PWA mode**
   - What we know: Standard Geolocation API returns heading when moving. Works in Safari.
   - What's unclear: Whether standalone PWA mode has any restrictions on heading data.
   - Recommendation: Implement heading fallback (bearing from last 2 positions) per user decision. This covers any case where heading is null.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (globals mode) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Heading smoothing, bearing calculation from 2 points | unit | `npx vitest run src/lib/__tests__/navigation.test.ts -t "heading"` | Wave 0 |
| NAV-02 | Point-to-segment distance, off-route detection, compass direction | unit | `npx vitest run src/lib/__tests__/navigation.test.ts -t "offRoute\|compass\|segment"` | Wave 0 |
| NAV-03 | Milestone detection, message formatting for all 3 styles | unit | `npx vitest run src/lib/__tests__/milestones.test.ts` | Wave 0 |
| NAV-04 | Voice mute/unmute respects voiceEnabled flag | unit | Already covered by existing voice toggle wiring (manual) | N/A manual |
| NAV-05 | iOS audio unlock function called, cancel on visibility change | unit | `npx vitest run src/lib/__tests__/voice.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/navigation.test.ts` -- covers NAV-01, NAV-02 (pointToSegmentDistance, distanceToRoute, getCompassDirection, smoothHeading)
- [ ] `src/lib/__tests__/milestones.test.ts` -- covers NAV-03 (detectMilestone, formatMilestoneMessage for all 3 styles x 2 unit systems)
- [ ] `src/lib/__tests__/voice.test.ts` -- covers NAV-05 (unlockIOSAudio, ensureSpeechReady)

## Sources

### Primary (HIGH confidence)
- MapLibre GL JS official docs (maplibre.org/maplibre-gl-js/docs/API/) - easeTo, bearing, pitch, CameraOptions, interaction events
- Codebase inspection - MapView.tsx, NavigationView.tsx, voice.ts, gps-filter.ts, geolocation.ts, types/index.ts, useRunSession.ts, storage.ts, metrics.ts, SettingsView.tsx, page.tsx

### Secondary (MEDIUM confidence)
- Web Speech API MDN docs - speechSynthesis behavior, cancel/speak lifecycle
- WebOutLoud Safari speech analysis (weboutloud.io) - iOS background speech breakage documented
- Apple Developer Forums - speechSynthesis iOS issues confirmed by multiple developers
- movable-type.co.uk/scripts/latlong.html - bearing calculation between coordinates

### Tertiary (LOW confidence)
- iOS Safari standalone PWA mode speech recovery - needs manual testing on device

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, APIs verified against docs
- Architecture: HIGH - pure function pattern matches existing codebase style, MapLibre API confirmed
- Pitfalls: HIGH - coordinate confusion and iOS speech issues well-documented
- iOS PWA audio: MEDIUM - unlock pattern widely used but background recovery needs device testing

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable APIs, no fast-moving dependencies)
