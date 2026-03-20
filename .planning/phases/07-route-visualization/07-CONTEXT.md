# Phase 7: Route Visualization - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform route rendering from a simple green line into a premium visual product — elevation-colored gradients, clear start/finish markers, directional turn indicators, and OLED-optimized dark mode map styling.

</domain>

<decisions>
## Implementation Decisions

### Elevation Gradient Rendering
- MapLibre line-gradient with data-driven color stops based on elevation grade — native GL performance
- Elevation data sourced from OSRM route response (already available per waypoint)
- Color scale: green (#22c55e) for flat → yellow (#eab308) gentle → orange (#f97316) moderate → red (#ef4444) steep
- Grade thresholds: <2% = green, 2-4% = yellow, 4-8% = orange, >8% = red

### Start/Finish Markers & Turn Indicators
- Start marker: green circle; Finish marker: checkered flag icon — universally recognized
- Turn indicators: small directional arrows at key decision points along the route
- Only show turn indicators at significant turns (>30° direction change) to avoid clutter
- All markers rendered via MapLibre symbols layer — native GL, performant

### Dark Mode & OLED Optimization
- Dark matter / dark-themed raster tiles for map background — true black for OLED
- Route line width: 5px for main route, 3px for secondary (trace overlay in summary/detail)
- Anti-aliasing via MapLibre native GL: line-cap: round, line-join: round for smooth curves
- Overall palette: gradient colors on true dark (#0a0a0a) background — premium OLED feel

### Claude's Discretion
- Exact dark tile provider URL (CartoDB dark_all, Stadia dark, or similar free dark tiles)
- Start/finish marker exact sizing and positioning
- Turn arrow icon design (SVG arrow, rotation angle)
- Elevation gradient interpolation smoothness
- Z-ordering of layers (gradient route, markers, turn indicators)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MapView.tsx`: MapLibre GL JS v5.20.2, route line rendering, user location marker, bearing rotation
- `RunSummaryView.tsx` and `RunDetailOverlay.tsx`: Dual polyline rendering (route + trace)
- `RouteThumbnail.tsx`: Canvas-based polyline rendering for cards
- Route data: `GeneratedRoute.polyline` as `[lng, lat][]` coordinates
- Route instructions with maneuver locations for turn placement

### Established Patterns
- MapLibre sources and layers via `map.addSource()` / `map.addLayer()`
- GeoJSON feature collections for route data
- Dark theme: bg-gray-900, green-400 accent throughout app
- Current route line: single green line at 4px width, opacity 0.8

### Integration Points
- `MapView.tsx` route rendering needs upgrade from simple line to gradient + markers
- `RunSummaryView.tsx` and `RunDetailOverlay.tsx` route layers should also benefit
- Tile URL currently OpenStreetMap raster — needs dark variant
- Route instructions array has maneuver lat/lng for turn indicator placement

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
