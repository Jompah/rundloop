# Phase 3: Live Run Metrics - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a glanceable live metrics overlay that shows real-time running stats (pace, distance, time, remaining distance) during an active run. This is the single most important screen in the running app — optimized for readability at pace.

</domain>

<decisions>
## Implementation Decisions

### Metrics Layout & Visual Hierarchy
- Metrics arranged in a 2x2 grid (pace, distance, time, remaining)
- Panel lives as a semi-transparent overlay on the bottom half of the map — runner still sees the route
- Pace is the hero metric (largest), other three metrics equal size below
- Fixed layout — no customization in this phase

### Pace Calculation & Display
- Rolling pace uses a 30-second window — balances responsiveness and stability
- Pace displayed as "5:30 /km" (min:sec per km) — standard running format
- Both current rolling pace and average pace shown — runners want current effort vs overall
- On pause: freeze last pace value, dim slightly to signal paused state

### Distance & Time Display
- Distance shown with 1 decimal precision (e.g., "3.2 km")
- Remaining distance = route total distance minus distance covered
- Time format: "MM:SS" under 1 hour, "H:MM:SS" over 1 hour (matches existing NavigationView format)
- All distance and pace display respects the existing `settings.units` preference (km/miles)

### Claude's Discretion
- Exact color palette and font sizes for the metrics overlay (must be high contrast, dark theme)
- Animation/transition details for metrics updates
- Exact positioning and spacing within the 2x2 grid

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useRunSession` hook provides `elapsedMs`, `distanceMeters`, `trace`, `status` — all data sources needed
- `haversineMeters()` and `computeDistance()` — proven distance calculation utilities
- `formatDistance()` and `formatElapsed()` in NavigationView — reusable formatting functions
- `FilteredPosition` type with `{ lat, lng, accuracy, timestamp, speed }` — GPS data structure
- `getSettings()` provides `units: 'km' | 'miles'` preference

### Established Patterns
- Dark theme default: `bg-gray-900/95`, `text-white`
- State kept in `useRef` to avoid render cascades on GPS ticks
- Timer updates every 100ms via `setInterval` with wall-clock math
- GPS trace accumulated via `watchFilteredPosition` callback
- Tailwind 4 + postcss for styling

### Integration Points
- `NavigationView` already receives `elapsedMs`, `distanceMeters`, `runStatus` as props
- `page.tsx` passes `runSession` data to NavigationView — same pattern for metrics
- `runSession.trace` provides GPS history needed for rolling pace calculation
- Route data accessible via `runSession.routeId` for remaining distance calculation

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
