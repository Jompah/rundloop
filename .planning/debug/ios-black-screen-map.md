---
status: awaiting_human_verify
trigger: "Map doesn't render on iPhone — user sees black screen with UI chrome (bottom nav tabs, simulate GPS button) but no map content."
created: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Focus

hypothesis: MapView container uses `h-full` (height:100%) which doesn't resolve correctly on iOS Safari when nested in a flex-col body layout. The map canvas gets 0 height, rendering black.
test: Change MapView container to use absolute positioning (inset-0) instead of h-full, and ensure map.resize() is called on container resize
expecting: Map renders correctly on iOS Safari with absolute positioning
next_action: Apply fix to MapView.tsx

## Symptoms

expected: Map renders with route generation UI on iPhone Safari, same as desktop
actual: Black screen where the map should be. Bottom navigation (map, history, route tabs) and "Simulate GPS" button in top-right are visible. Nothing else renders.
errors: None reported (user can't see console)
reproduction: Open rundloop.vercel.app on iPhone Safari
started: First time opening on iPhone — v1.0 just shipped

## Eliminated

## Evidence

- timestamp: 2026-03-21T00:10:00Z
  checked: Layout hierarchy (html -> body -> main -> MapView)
  found: body has `min-h-full flex flex-col`, main has `h-[100dvh]`, MapView uses `h-full` (height:100%). iOS Safari has known WebKit bug (#137730) where height:100% doesn't resolve correctly inside flex items.
  implication: MapView container likely gets 0 height on iOS Safari, causing WebGL canvas to render at 0x0 pixels

- timestamp: 2026-03-21T00:12:00Z
  checked: MapLibre GL CSS (.maplibregl-canvas)
  found: Canvas is position:absolute inside .maplibregl-map container. Canvas dimensions are set from container.clientWidth/clientHeight at init time.
  implication: If container has 0 height at init, canvas will be 0x0 = black screen

- timestamp: 2026-03-21T00:14:00Z
  checked: Loading overlay in MapView
  found: Shows bg-[#0a0a0a] (nearly black) with "Loading map..." text when !mapLoaded. This could be what user sees as "black screen."
  implication: If map style loads but canvas is 0x0, map appears loaded but shows nothing. Loading overlay disappears but map is invisible.

## Resolution

root_cause: MapView container used `h-full` (height:100%) which doesn't resolve correctly on iOS Safari when nested inside a flex-col body layout. The WebKit engine has a known bug (#137730) where percentage heights don't resolve inside flex items. Combined with `100dvh` on the parent `<main>` element and dynamic import timing, the map container could initialize with 0 height, causing the WebGL canvas to render at 0x0 pixels (black screen). Additionally, no ResizeObserver was in place to call map.resize() if the container dimensions changed after initialization.
fix: Changed MapView outer container from `relative w-full h-full` to `absolute inset-0` (absolute positioning with top/right/bottom/left: 0), eliminating dependency on the percentage height chain. Added ResizeObserver on the map container to call map.resize() whenever dimensions change, ensuring the WebGL canvas always matches the container size.
verification: Build passes. Desktop behavior preserved (absolute inset-0 on a child of the relative-positioned main element produces identical layout to w-full h-full). iOS verification needed by user.
files_changed: [src/components/MapView.tsx]
