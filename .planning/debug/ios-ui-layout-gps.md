---
status: awaiting_human_verify
trigger: "Three iOS UX issues: (1) Create route button covered by tab bar, (2) GPS simulation on by default, (3) No locate-me button"
created: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:02:00Z
---

## Current Focus

hypothesis: All three issues identified and fixed
test: Build passes, type-check clean
expecting: User verifies on iPhone Safari
next_action: Await human verification

## Symptoms

expected: (1) Generate route button fully visible above bottom nav, (2) Real GPS used by default on real devices, (3) A "locate me" button to center map on user's current GPS position
actual: (1) Button partially hidden behind bottom tab bar on iPhone, (2) "Simulera GPS" toggle is on by default so the app uses simulated position, (3) No way to center map on real location
errors: None — layout/UX issues
reproduction: Open rundloop.vercel.app on iPhone Safari
started: First time testing on real iPhone device after v1.0 ship

## Eliminated

## Evidence

- timestamp: 2026-03-21T00:01:00Z
  checked: RouteGenerator.tsx and page.tsx bottom panel positioning
  found: Both RouteGenerator (line 49) and route info bar (page.tsx line 556) use `absolute bottom-0` with z-20, same z-index as TabBar which is `fixed bottom-0` z-20. The panels render behind the tab bar because neither accounts for the tab bar height (h-14 = 3.5rem + safe-area-inset-bottom).
  implication: Issue 1 confirmed - panels need bottom offset matching tab bar height

- timestamp: 2026-03-21T00:01:00Z
  checked: page.tsx GPS initialization (lines 122-156)
  found: GPS is NOT "on by default". When real geolocation fails (permission denied or timeout), the catch block at line 147 silently called `applyFakeGPS(fallback)` which activated simulated GPS to Stockholm without user awareness. User sees "Simulerad GPS" badge but doesn't understand why or how to fix it.
  implication: Issue 2 confirmed - need explicit error message with retry option instead of silent fallback

- timestamp: 2026-03-21T00:01:00Z
  checked: MapView.tsx locate-me button (lines 236-248)
  found: A "Center on my location" button exists with `centerOnUser` callback, but positioned at `bottom-6 right-4` with z-10. The RouteGenerator panel (z-20) and TabBar (z-20) both cover this button on iPhone. The button is effectively invisible.
  implication: Issue 3 confirmed - button needs repositioning with higher z-index

## Resolution

root_cause: |
  1. Bottom panels (RouteGenerator, route info bar) positioned at `bottom-0` overlap the fixed TabBar (also `bottom-0`, h-14 + safe-area)
  2. GPS init silently falls back to fake GPS when real geolocation fails, confusing users on real devices
  3. Locate-me button exists but is hidden behind bottom panels (z-10 < z-20) and positioned behind tab bar
fix: |
  1. Changed RouteGenerator and route info bar bottom positioning from `bottom-0` to `bottom-[calc(3.5rem+env(safe-area-inset-bottom))]` to sit above TabBar
  2. Replaced silent fake GPS fallback with explicit error banner showing "GPS-position saknas" with "Forsok igen" (retry) and "Simulera position" buttons
  3. Moved locate-me button to `top-24 right-4` with z-30 so it's visible above all panels
  Also: Updated RunHistoryView and SavedRoutesView padding-bottom to account for TabBar + safe-area
verification: TypeScript type-check passes, production build succeeds
files_changed:
  - src/components/RouteGenerator.tsx
  - src/app/page.tsx
  - src/components/MapView.tsx
  - src/components/RunHistoryView.tsx
  - src/components/SavedRoutesView.tsx
