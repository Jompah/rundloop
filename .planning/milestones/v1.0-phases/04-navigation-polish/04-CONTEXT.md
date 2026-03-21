# Phase 4: Navigation Polish - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish turn-by-turn navigation with map auto-rotation, off-route detection with return guidance, voice distance milestone cues with configurable styles, and iOS Safari PWA audio compatibility. Voice muting already works from Phase 2/3.

</domain>

<decisions>
## Implementation Decisions

### Map Rotation & Heading
- Map rotates smoothly via `map.easeTo({ bearing })` on each GPS update during active navigation
- Slight 30° pitch (tilt) during navigation for forward-looking perspective like car GPS
- If heading is null, fall back to calculated bearing from last 2 GPS points
- Manual interaction (pan/zoom) disables auto-rotation; "re-center" button re-enables it

### Off-Route Detection & Alerts
- Custom point-to-segment distance calculation (no new dependency like turf.js) — iterate route segments, find nearest point
- Alert via banner at top of screen + haptic vibration + voice announcement — multi-sensory for runners not looking at screen
- Return guidance: "Off route — head [direction] to rejoin" with compass direction (N/NE/E/SE/S/SW/W/NW)
- Check deviation every GPS tick (already filtering, computationally cheap)
- Deviation threshold: 50m from route triggers alert

### Voice Milestones & iOS Audio
- Announce every whole km milestone (1, 2, 3...) plus halfway point
- Three configurable voice styles (user selectable in settings):
  - Concise: "{N} kilometer completed" / "Halfway point"
  - With pace: "{N} kilometer completed. Average pace: {pace} per kilometer"
  - Motivational: "Great work! {N} kilometers done"
- iOS Safari audio context unlocked via silent `speechSynthesis.speak("")` on first user gesture (run start button tap)
- Milestone announcements respect user's km/miles unit preference from settings

### Claude's Discretion
- Off-route banner visual design (colors, animation, positioning)
- Exact heading smoothing algorithm (if needed to reduce jitter)
- Settings UI layout for voice style selection
- Re-center button placement and visual design

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/voice.ts` — Web Speech API wrapper with `speak(text, enabled)` and `stopSpeaking()`
- `NavigationView.tsx` — Turn-by-turn instructions, voice integration, step advancement at 25m proximity
- `MapView.tsx` — MapLibre GL JS v5.20.2, user location marker, route line, center-on-user
- `useRunSession` hook — trace, distanceMeters, status, runSession.route
- `gps-filter.ts` — `watchFilteredPosition()` pipeline (heading available in raw GeoPosition but NOT in FilteredPosition type)
- `RunMetricsOverlay.tsx` — Voice toggle button already wired

### Established Patterns
- Dark theme: bg-gray-900/95, text-white, green-400 accent
- Haptic feedback via `navigator.vibrate()` on step changes
- Voice stops on pause, resumes on active
- Settings persisted via IndexedDB `saveSettings()`
- 100ms timer interval drives re-renders

### Integration Points
- `FilteredPosition` type needs `heading: number | null` field added
- `gps-filter.ts` needs to preserve heading from raw GeoPosition
- `MapView.tsx` needs bearing prop or heading-aware navigation mode
- `NavigationView.tsx` needs milestone detection and off-route logic
- Settings need `voiceStyle: 'concise' | 'with-pace' | 'motivational'` field

</code_context>

<specifics>
## Specific Ideas

- User wants 3 voice style options selectable in settings — concise, with-pace, motivational
- Off-route detection should be non-blocking (banner, not modal) to avoid disrupting the run
- Map rotation should feel smooth and natural, similar to Google Maps navigation mode

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
