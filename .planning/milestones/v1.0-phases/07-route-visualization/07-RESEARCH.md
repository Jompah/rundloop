# Phase 7: Route Visualization - Research

**Researched:** 2026-03-20
**Domain:** MapLibre GL JS route rendering, elevation data, dark map tiles
**Confidence:** HIGH

## Summary

This phase upgrades route rendering from a single green line to a premium visual product with elevation-colored gradients, start/finish markers, turn indicators, and OLED-optimized dark tiles. The codebase already uses MapLibre GL JS v5.20.2 with GeoJSON sources and layers, so the rendering infrastructure exists.

The critical technical finding is that **OSRM does not provide elevation data** in its route responses -- contrary to the CONTEXT.md assumption. Elevation must be fetched separately from a free API (Open-Meteo Elevation API recommended). Additionally, MapLibre's `line-gradient` property only supports `line-progress` (position along line), not arbitrary data-driven values. The elevation gradient must therefore use a pre-computed color mapping where elevation grades are mapped to `line-progress` color stops, since the route is a single LineString and progress correlates with coordinate index position.

**Primary recommendation:** Fetch elevation from Open-Meteo, compute grades per segment, then map those grades to `line-progress` color stops on a single `line-gradient` layer. Use CartoDB dark-matter vector tiles (already used in RunSummaryView/RunDetailOverlay) for the main MapView.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- MapLibre line-gradient with data-driven color stops based on elevation grade -- native GL performance
- Elevation data sourced from OSRM route response (already available per waypoint) **[RESEARCH CORRECTION: OSRM does NOT provide elevation -- must use Open-Meteo API instead]**
- Color scale: green (#22c55e) for flat, yellow (#eab308) gentle, orange (#f97316) moderate, red (#ef4444) steep
- Grade thresholds: <2% = green, 2-4% = yellow, 4-8% = orange, >8% = red
- Start marker: green circle; Finish marker: checkered flag icon
- Turn indicators: small directional arrows at key decision points (>30 degree direction change)
- All markers rendered via MapLibre symbols layer
- Dark matter / dark-themed raster tiles for map background
- Route line width: 5px main route, 3px secondary
- Anti-aliasing via line-cap: round, line-join: round
- Overall palette: gradient colors on true dark (#0a0a0a) background

### Claude's Discretion
- Exact dark tile provider URL (CartoDB dark_all, Stadia dark, or similar free dark tiles)
- Start/finish marker exact sizing and positioning
- Turn arrow icon design (SVG arrow, rotation angle)
- Elevation gradient interpolation smoothness
- Z-ordering of layers (gradient route, markers, turn indicators)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIZ-01 | Smooth, anti-aliased route lines on the map | MapLibre line-cap/line-join: round on line layer; already partially in place |
| VIZ-02 | Colored gradient along route indicating elevation changes | line-gradient with line-progress + Open-Meteo elevation API for grade computation |
| VIZ-03 | Clear start/finish marker on the route | MapLibre Marker API or symbol layer with custom HTML/SVG elements |
| VIZ-04 | Turn indicators at key decision points | Filter TurnInstruction[] for >30 degree turns, render as symbol layer with rotation |
| VIZ-05 | Dark-mode-friendly color scheme optimized for OLED | CartoDB dark-matter GL style (already used in 2 components) + true dark background |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | ^5.20.2 (installed) | Map rendering, line-gradient, symbol layers | Already in project, native WebGL performance |
| Open-Meteo Elevation API | v1 | Free elevation data for route coordinates | Free, worldwide, 90m resolution, no API key needed for non-commercial |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CartoDB dark-matter GL style | current | Dark vector tile basemap | Main map background, already used in RunSummaryView and RunDetailOverlay |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Open-Meteo | Open-Elevation | Open-Elevation limited to 1000 req/month; Open-Meteo more generous |
| Open-Meteo | Open Topo Data | Max 100 locations/req, 1000 calls/day; Open-Meteo allows 100 coords per call with no hard daily limit |
| CartoDB dark-matter | Stadia Alidade Smooth Dark | Stadia requires API key for production; CartoDB free and already used |

**No new npm packages needed.** All visualization uses MapLibre GL JS APIs already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── elevation.ts         # Open-Meteo elevation fetching + grade computation
│   └── route-visuals.ts     # Shared route rendering utilities (gradient, markers, turn indicators)
├── components/
│   ├── MapView.tsx           # Updated: dark tiles + gradient route + markers + turns
│   ├── RunSummaryView.tsx    # Updated: gradient route on summary map
│   └── RunDetailOverlay.tsx  # Updated: gradient route on detail map
```

### Pattern 1: Elevation-to-Grade-to-Gradient Pipeline

**What:** Fetch elevation for route coordinates, compute grade between consecutive points, map grades to line-progress color stops.

**When to use:** Every time a route is displayed with elevation gradient.

**Pipeline:**
```
Route polyline [lng,lat][]
  -> Batch fetch elevation from Open-Meteo (max 100 per request)
  -> Compute grade % between consecutive points
  -> Map each segment's cumulative distance to line-progress (0-1)
  -> Build interpolate expression with color stops at each transition
  -> Apply as line-gradient paint property
```

**Example:**
```typescript
// elevation.ts
interface ElevationPoint {
  lng: number;
  lat: number;
  elevation: number; // meters
}

async function fetchElevations(coords: [number, number][]): Promise<number[]> {
  // coords are [lng, lat], Open-Meteo expects lat, lng
  // Batch in groups of 100
  const elevations: number[] = [];
  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const lats = batch.map(c => c[1]).join(',');
    const lngs = batch.map(c => c[0]).join(',');
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
    );
    const data = await res.json();
    elevations.push(...data.elevation);
  }
  return elevations;
}

function computeGrades(
  coords: [number, number][],
  elevations: number[]
): number[] {
  // Returns grade (%) for each segment between consecutive points
  const grades: number[] = [0]; // first point has no grade
  for (let i = 1; i < coords.length; i++) {
    const dist = haversineMeters(coords[i-1], coords[i]);
    const elevDiff = elevations[i] - elevations[i-1];
    const grade = dist > 0 ? Math.abs(elevDiff / dist) * 100 : 0;
    grades.push(grade);
  }
  return grades;
}

function gradeToColor(grade: number): string {
  if (grade < 2) return '#22c55e';  // green - flat
  if (grade < 4) return '#eab308';  // yellow - gentle
  if (grade < 8) return '#f97316';  // orange - moderate
  return '#ef4444';                  // red - steep
}
```

### Pattern 2: Line-Gradient with Precomputed Color Stops

**What:** MapLibre `line-gradient` uses `line-progress` (0 to 1) to assign colors along a line. We pre-compute where each grade change occurs as a fraction of total route distance and build the interpolate expression.

**Key requirement:** Source must have `lineMetrics: true`.

**Example:**
```typescript
function buildGradientExpression(
  coords: [number, number][],
  grades: number[]
): maplibregl.ExpressionSpecification {
  // Compute cumulative distance for each point
  let totalDist = 0;
  const cumDist = [0];
  for (let i = 1; i < coords.length; i++) {
    totalDist += haversineMeters(coords[i-1], coords[i]);
    cumDist.push(totalDist);
  }

  // Build color stops as [progress, color] pairs
  const stops: (number | string)[] = [];
  for (let i = 0; i < coords.length; i++) {
    const progress = totalDist > 0 ? cumDist[i] / totalDist : 0;
    const color = gradeToColor(grades[i]);
    stops.push(progress, color);
  }

  // Deduplicate consecutive same-color stops for performance
  const deduped: (number | string)[] = [stops[0], stops[1]];
  for (let i = 2; i < stops.length; i += 2) {
    if (stops[i + 1] !== deduped[deduped.length - 1]) {
      deduped.push(stops[i], stops[i + 1]);
    }
  }

  return [
    'interpolate',
    ['linear'],
    ['line-progress'],
    ...deduped
  ] as maplibregl.ExpressionSpecification;
}
```

### Pattern 3: Markers via HTML Elements (not symbol layer)

**What:** For start/finish markers, use MapLibre `Marker` with custom HTML elements rather than symbol layers. This is simpler for 2 fixed points and avoids image sprite management.

**Why not symbol layer for markers:** Symbol layers require loading images into the map sprite. For just 2 markers, HTML Marker is simpler and allows CSS styling. Turn indicators, being numerous, should still use a symbol layer.

**Example:**
```typescript
// Start marker: green circle
const startEl = document.createElement('div');
startEl.style.cssText = `
  width: 20px; height: 20px; border-radius: 50%;
  background: #22c55e; border: 3px solid white;
  box-shadow: 0 0 8px rgba(34,197,94,0.5);
`;
new maplibregl.Marker({ element: startEl })
  .setLngLat(coords[0])
  .addTo(map);

// Finish marker: checkered flag via SVG
const finishEl = document.createElement('div');
finishEl.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24">...</svg>`;
new maplibregl.Marker({ element: finishEl, anchor: 'bottom' })
  .setLngLat(coords[coords.length - 1])
  .addTo(map);
```

### Pattern 4: Turn Indicators via Symbol Layer

**What:** Filter route instructions for significant turns (>30 degree), render as a GeoJSON point source with a rotated arrow symbol.

**Example:**
```typescript
// Create arrow image (once, on map load)
const arrowCanvas = document.createElement('canvas');
arrowCanvas.width = 32;
arrowCanvas.height = 32;
const ctx = arrowCanvas.getContext('2d')!;
// Draw simple arrow
ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.moveTo(16, 4);
ctx.lineTo(28, 28);
ctx.lineTo(16, 20);
ctx.lineTo(4, 28);
ctx.closePath();
ctx.fill();

map.addImage('turn-arrow', arrowCanvas);

// Add turn points as GeoJSON
const turnFeatures = significantTurns.map(turn => ({
  type: 'Feature' as const,
  properties: { bearing: turn.bearing },
  geometry: { type: 'Point' as const, coordinates: turn.location }
}));

map.addSource('turn-indicators', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: turnFeatures }
});

map.addLayer({
  id: 'turn-arrows',
  type: 'symbol',
  source: 'turn-indicators',
  layout: {
    'icon-image': 'turn-arrow',
    'icon-size': 0.5,
    'icon-rotate': ['get', 'bearing'],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true,
  }
});
```

### Z-Ordering Recommendation
1. Base tiles (dark-matter) -- bottom
2. Route gradient line (id: `route-gradient`) -- above tiles
3. Turn indicator symbols (id: `turn-arrows`) -- above route
4. Start/finish markers (HTML Markers) -- always on top (DOM overlay)

### Anti-Patterns to Avoid
- **Multiple line layers per segment:** Creating one layer per route segment for coloring. This is extremely slow for routes with hundreds of points. Use single line-gradient instead.
- **Loading external icon fonts for markers:** Unnecessary dependency. Use inline SVG or canvas-drawn images.
- **Fetching elevation on every render:** Cache elevation data alongside the route. Fetch once when route is generated, store in the GeneratedRoute type.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark map tiles | Custom tile server | CartoDB dark-matter GL style URL | Free, maintained, vector tiles with good labeling |
| Elevation data | Manual DEM tile parsing | Open-Meteo Elevation API | Simple REST API, worldwide, free for non-commercial |
| Smooth line rendering | Canvas overlay | MapLibre native line layer with round caps/joins | WebGL accelerated, handles zoom/rotation |
| Gradient coloring | Per-segment line layers | Single line-gradient with line-progress | One draw call vs hundreds |
| Arrow rotation | Manual trig per frame | MapLibre icon-rotate + icon-rotation-alignment: map | Native GL rotation, updates on map rotate |

**Key insight:** MapLibre GL does all the heavy rendering work. The custom code is purely data preparation (elevation fetching, grade computation, color stop mapping). Do not build custom rendering pipelines.

## Common Pitfalls

### Pitfall 1: OSRM Does Not Provide Elevation
**What goes wrong:** CONTEXT.md assumes elevation is in OSRM response. It is not.
**Why it happens:** OSRM is a routing engine, not a terrain service. It returns geometry, distance, duration, and steps.
**How to avoid:** Fetch elevation separately from Open-Meteo after receiving OSRM route.
**Warning signs:** `undefined` elevation values, flat gradient on hilly routes.

### Pitfall 2: lineMetrics Must Be Enabled for line-gradient
**What goes wrong:** line-gradient silently fails if the GeoJSON source does not have `lineMetrics: true`.
**Why it happens:** MapLibre needs to compute line distances internally for `line-progress`.
**How to avoid:** Always set `lineMetrics: true` on GeoJSON sources that use line-gradient.
**Warning signs:** Route appears but with no color gradient (falls back to `line-color`).

### Pitfall 3: Too Many Color Stops Hurts Performance
**What goes wrong:** A 500-point route generates 500 color stops in the interpolate expression.
**Why it happens:** Each coordinate pair generates a stop.
**How to avoid:** Sample/deduplicate stops. Only add a new stop when the color changes. A typical 5-10km route needs 20-50 meaningful stops, not 500.
**Warning signs:** Laggy map rendering, slow layer add.

### Pitfall 4: Open-Meteo Rate Limiting
**What goes wrong:** Rapid successive requests get throttled or fail.
**Why it happens:** Free API has implicit rate limits.
**How to avoid:** Batch coordinates (max 100 per request). Cache results. A typical 5km route has ~200-500 coordinates = 2-5 API calls.
**Warning signs:** 429 responses, empty elevation arrays.

### Pitfall 5: Bearing Computation for Turn Arrows
**What goes wrong:** Turn arrows point in wrong direction.
**Why it happens:** MapLibre icon-rotate uses clockwise degrees from north. Bearing calculation must match.
**How to avoid:** Use consistent bearing formula: atan2-based, returning 0-360 clockwise from north.
**Warning signs:** Arrows pointing backward or sideways at turns.

### Pitfall 6: Dark Tile Style Mismatch Between Views
**What goes wrong:** MapView uses OSM raster tiles (light), but RunSummaryView/RunDetailOverlay use CartoDB dark-matter.
**Why it happens:** MapView was built first with OSM tiles, summary views added dark tiles later.
**How to avoid:** Unify all map instances to use the same dark-matter style.
**Warning signs:** Jarring light-to-dark transition when entering/leaving run summary.

## Code Examples

### Open-Meteo Elevation Fetch (verified API format)
```typescript
// Source: https://open-meteo.com/en/docs/elevation-api
// Up to 100 coordinates per request
async function fetchElevationBatch(
  coords: [number, number][] // [lng, lat]
): Promise<number[]> {
  const lats = coords.map(c => c[1]).join(',');
  const lngs = coords.map(c => c[0]).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Elevation API failed: ${res.status}`);
  const data = await res.json();
  return data.elevation as number[];
}
```

### MapLibre Line-Gradient (verified from official docs)
```typescript
// Source: https://maplibre.org/maplibre-gl-js/docs/examples/create-a-gradient-dashed-line-using-an-expression/
// CRITICAL: lineMetrics must be true
map.addSource('route', {
  type: 'geojson',
  lineMetrics: true, // REQUIRED for line-gradient
  data: routeGeoJSON,
});

map.addLayer({
  id: 'route-gradient',
  type: 'line',
  source: 'route',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-width': 5,
    'line-gradient': [
      'interpolate',
      ['linear'],
      ['line-progress'],
      0, '#22c55e',
      0.25, '#eab308',
      0.5, '#f97316',
      1, '#ef4444'
    ],
  },
});
```

### CartoDB Dark-Matter Style URL (already used in project)
```typescript
// Already in RunSummaryView.tsx and RunDetailOverlay.tsx
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// For MapView: replace inline OSM raster style with this URL
const map = new maplibregl.Map({
  container: mapContainer.current,
  style: DARK_STYLE,
  center: [18.0686, 59.3293],
  zoom: 13,
  attributionControl: false,
});
```

### Significant Turn Detection
```typescript
// Filter turns from existing TurnInstruction[]
// Only show turns with >30 degree direction change
function getSignificantTurns(
  instructions: TurnInstruction[]
): TurnInstruction[] {
  return instructions.filter(
    inst => inst.type === 'turn-left' || inst.type === 'turn-right' || inst.type === 'u-turn'
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-segment line layers for gradient | Single line-gradient with line-progress | MapLibre v2+ | Massive performance improvement, single draw call |
| Mapbox GL JS | MapLibre GL JS | 2021 (fork) | Open source, same API, free |
| Google Elevation API | Open-Meteo Elevation API | 2023+ | Free, no API key, worldwide coverage |
| OSM raster tiles | CartoDB vector dark-matter | Available since 2018 | Better labels, true dark, vector quality |

**Deprecated/outdated:**
- Mapbox GL JS: Forked to MapLibre; project already uses MapLibre
- `line-gradient` with data-driven properties: Still an open feature request (issue #5037), NOT implemented as of MapLibre v5.21

## Open Questions

1. **Elevation data caching strategy**
   - What we know: Open-Meteo is free and fast, routes are typically 200-500 points
   - What's unclear: Should elevation be stored in GeneratedRoute type or fetched on each render?
   - Recommendation: Store elevation array alongside polyline in GeneratedRoute to avoid repeated API calls. This requires a type extension.

2. **Route polyline sampling for elevation**
   - What we know: OSRM returns detailed polylines (hundreds of points for a 5km route)
   - What's unclear: Optimal sampling rate for elevation (every point vs every Nth point)
   - Recommendation: Sample every ~50m (skip points closer than 50m apart) to reduce API calls while maintaining gradient accuracy. Interpolate elevations for skipped points.

3. **Fallback when elevation API is unavailable**
   - What we know: Route still needs to render even without elevation
   - What's unclear: Best fallback UX
   - Recommendation: Fall back to solid green line (current behavior) if elevation fetch fails. Show gradient only when elevation data is available.

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
| VIZ-01 | Smooth anti-aliased lines (round caps/joins) | manual-only | N/A -- visual rendering | N/A |
| VIZ-02 | Elevation gradient coloring | unit | `npx vitest run src/lib/__tests__/elevation.test.ts -x` | No -- Wave 0 |
| VIZ-03 | Start/finish markers present | manual-only | N/A -- DOM marker visual | N/A |
| VIZ-04 | Turn indicators at decision points | unit | `npx vitest run src/lib/__tests__/elevation.test.ts -x` | No -- Wave 0 |
| VIZ-05 | Dark mode OLED palette | manual-only | N/A -- visual/style check | N/A |

**Justification for manual-only items:** VIZ-01, VIZ-03, VIZ-05 are purely visual rendering concerns that cannot be meaningfully tested without a browser and visual inspection. MapLibre GL requires WebGL context not available in Node/jsdom.

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/elevation.test.ts` -- covers VIZ-02 (grade computation, color stop mapping, batching logic) and VIZ-04 (significant turn filtering, bearing computation)
- [ ] No new framework install needed -- vitest already configured

## Sources

### Primary (HIGH confidence)
- MapLibre GL JS official docs -- line-gradient, expressions, symbol layers
- Project source code -- MapView.tsx, RunSummaryView.tsx, RunDetailOverlay.tsx, route-osrm.ts, types/index.ts
- Open-Meteo Elevation API docs (https://open-meteo.com/en/docs/elevation-api)

### Secondary (MEDIUM confidence)
- CartoDB basemap styles (https://github.com/CartoDB/basemap-styles)
- MapLibre style spec layers (https://maplibre.org/maplibre-style-spec/layers/)
- MapLibre issue #5037 (https://github.com/maplibre/maplibre-gl-js/issues/5037) -- confirmed data-driven line-gradient NOT available

### Tertiary (LOW confidence)
- Open-Meteo rate limits (not explicitly documented for free tier, inferred from API behavior)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, MapLibre already installed, Open-Meteo API verified
- Architecture: HIGH - line-gradient with line-progress is the proven approach, elevation pipeline is straightforward
- Pitfalls: HIGH - OSRM elevation gap verified by reading source code, lineMetrics requirement confirmed from docs

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain, MapLibre v5 unlikely to change line-gradient API)
