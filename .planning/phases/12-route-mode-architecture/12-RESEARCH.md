# Phase 12: Route Mode Architecture - Research

**Researched:** 2026-03-24
**Status:** Complete

## Current Architecture

### Type System
- `RouteMode` is currently `'ai' | 'algorithmic'` (defined in `src/types/index.ts`)
- `AppSettings` does not include any scenic mode preference
- No `ScenicMode` type exists yet

### Prompt Pipeline
- `src/lib/route-ai.ts` has a single `ROUTE_PROMPT` function that generates waypoints
- The prompt is hardcoded with general instructions (parks, waterfront, pedestrian areas)
- `generateRouteWaypoints()` takes `AIRouteRequest` with `{ lat, lng, distanceKm, cityName, settings }`
- No composable prompt system exists

### UI Flow
- `RouteGenerator.tsx` receives `routeMode` and `onModeChange` props but only toggles between `'ai'` and `'algorithmic'`
- The toggle is not rendered in the current RouteGenerator UI (props exist but no visual toggle)
- `page.tsx` manages `routeMode` state and passes it to `handleGenerate`

### Persistence
- Settings are stored in IndexedDB via `dbPut('settings', { key: 'app', ...settings })`
- `getSettings()` returns `AppSettings` merged with defaults
- Route mode preference is NOT currently persisted

### Route Generation Flow
1. User clicks "Generate" in `RouteGenerator`
2. `page.tsx` `handleGenerate` checks `routeMode`
3. If `'algorithmic'`: calls `generateRouteAlgorithmic()`
4. If `'ai'`: calls `generateRouteWaypoints()` which builds prompt and calls Claude/Perplexity
5. Waypoints go through binary search distance calibration
6. Street dedup check
7. Landmark fetch via Overpass

## Design Decisions

### ScenicMode Type
New type: `ScenicMode = 'standard' | 'nature' | 'explore'`
- Orthogonal to `RouteMode` ('ai' | 'algorithmic')
- Only applicable when `routeMode === 'ai'` (algorithmic ignores scenic preferences)
- Stored in `AppSettings` as `scenicMode: ScenicMode`

### Composable Prompt Architecture
The `ROUTE_PROMPT` function should be refactored into:
1. Base prompt (common to all modes) - start/end point, distance, JSON format
2. Mode-specific instructions injected based on `ScenicMode`
3. `standard` = current prompt (general "prefer parks, waterfront" instructions)
4. `nature` = emphasize green spaces, water, parks, quiet paths
5. `explore` = emphasize landmarks, viewpoints, touristy areas, cultural sites

### UI Toggle Design
- Three-segment toggle: Standard / Natur / Utforska
- Placed above the distance selector in RouteGenerator
- Disabled/hidden when `routeMode === 'algorithmic'`
- Swedish labels: "Standard", "Natur", "Utforska"

### Persistence
- `scenicMode` added to `AppSettings` interface
- Default: `'standard'`
- Persisted via existing `saveSettings()` / `getSettings()` pattern

### No-Regression Guarantee
- When `scenicMode === 'standard'`, the prompt must produce identical instructions to the current `ROUTE_PROMPT`
- The base prompt content for standard mode stays the same word-for-word

## Validation Architecture

### Test Strategy
1. Type check: `ScenicMode` type exported and used in `AppSettings`
2. Prompt composition: unit test that `buildRoutePrompt('standard', ...)` produces same output as current `ROUTE_PROMPT`
3. UI: toggle renders three segments, disabled state when algorithmic
4. Persistence: scenic mode round-trips through IndexedDB

## Files to Modify
- `src/types/index.ts` - Add `ScenicMode`, update `AppSettings`
- `src/lib/route-ai.ts` - Refactor prompt into composable system
- `src/components/RouteGenerator.tsx` - Add scenic mode toggle UI
- `src/app/page.tsx` - Wire scenic mode state + persistence
- `src/lib/storage.ts` - Add default for `scenicMode`
