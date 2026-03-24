# Phase 14: Flexible Start Point - Research

**Researched:** 2026-03-24
**Status:** Complete

## Current Architecture

### Route Start Point
- Currently, routes MUST start and end at the exact user GPS position
- The AI prompt says "The first and last waypoint must be the starting point"
- `generateRouteWaypoints` in `route-ai.ts` enforces this by prepending/appending the user position
- Algorithmic mode (`route-algorithmic.ts`) also starts at exact GPS position

### Map Rendering
- Route polyline is drawn via `addGradientRoute` in `route-visuals.ts`
- Start/finish markers via `addStartFinishMarkers`
- No concept of a "walk to start" segment exists

### Types
- `GeneratedRoute` has `polyline: [number, number][]` for the main route
- No field for walk-to-start segment

## Design Decisions

### Approach: Post-processing, Not Prompt Changes
Rather than asking the AI to choose a flexible start point (unreliable), we:
1. Keep the AI generating routes starting at the user's position
2. After OSRM returns the route, check if the first routed waypoint is within 300m
3. If the route's first snapped point differs from GPS by >10m but <300m, add a walk segment
4. If >300m, clamp (this shouldn't happen since we start at GPS)

The real value of flexible start is for OSRM snapping: OSRM snaps to the nearest road, which may be 50-200m from the actual GPS position. We should show this walking segment instead of pretending the runner teleports.

### Walk-to-Start Segment
- Compute a straight-line walk segment from user GPS to route start
- Use OSRM `nearest` service to find the nearest walkable road to GPS
- Draw as a dashed line on the map
- Store in `GeneratedRoute` as `walkToStart?: [number, number][]`

### Implementation
1. Add `walkToStart` field to `GeneratedRoute` type
2. After route generation, compute walk segment from GPS to first polyline point
3. Add `addWalkToStartLine` function to `route-visuals.ts`
4. Wire into MapView rendering

### OSRM Nearest Service
The OSRM public server supports the `nearest` service:
`GET https://router.project-osrm.org/nearest/v1/foot/{lng},{lat}`
This returns the nearest snapped point on the road network.
However, for simplicity we can just use the difference between GPS position and the first polyline coordinate (which OSRM already snapped).

## Files to Modify
- `src/types/index.ts` - Add `walkToStart` to `GeneratedRoute`
- `src/app/page.tsx` - Compute walk segment after route generation
- `src/lib/route-visuals.ts` - Add `addWalkToStartLine` function, update `removeRouteVisuals`
- `src/components/MapView.tsx` - Render walk-to-start segment
