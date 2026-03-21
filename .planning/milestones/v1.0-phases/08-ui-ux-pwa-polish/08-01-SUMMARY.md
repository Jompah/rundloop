---
phase: 08-ui-ux-pwa-polish
plan: 01
subsystem: ui
tags: [pwa, service-worker, haptics, motion, button-component, offline]

requires:
  - phase: 07-visualization
    provides: existing layout.tsx and globals.css foundation
provides:
  - Shared Button component with primary/secondary/destructive variants
  - Haptic feedback utility with tap/success/milestone/warning patterns
  - OfflineBanner with motion AnimatePresence animation
  - Service worker with cache-first static and network-first API strategy
  - PWA manifest with standalone display and #0a0a0a theme
  - PWAProvider wrapping layout with SW registration
  - viewport-fit=cover safe area support
  - Dark color-scheme forced via CSS
affects: [08-ui-ux-pwa-polish]

tech-stack:
  added: [motion]
  patterns: [PWAProvider client wrapper for server layout, haptic utility with feature detection]

key-files:
  created:
    - src/components/ui/Button.tsx
    - src/lib/haptics.ts
    - src/lib/__tests__/haptics.test.ts
    - src/components/ui/OfflineBanner.tsx
    - public/sw.js
    - src/components/PWAProvider.tsx
  modified:
    - public/manifest.json
    - src/app/layout.tsx
    - src/app/globals.css
    - package.json

key-decisions:
  - "PWAProvider client wrapper pattern to embed client components (SW reg + OfflineBanner) inside server layout"
  - "Installed motion package for AnimatePresence animations in OfflineBanner"
  - "Tile CDN caching with 50-entry eviction in separate cache bucket"

patterns-established:
  - "PWAProvider: client wrapper for embedding multiple client-only concerns in server layout"
  - "Haptic utility: feature-detect navigator.vibrate, no-op fallback"
  - "Button component: variant/size prop pattern with 44px min touch target"

requirements-completed: [UI-01, UI-03, UI-05, PWA-01, PWA-02, PWA-03]

duration: 8min
completed: 2026-03-20
---

# Phase 8 Plan 1: UI/UX PWA Polish Foundation Summary

**Shared Button with 3 variants, haptic feedback utility, OfflineBanner with motion animation, service worker with cache-first/network-first strategy, and PWA manifest with standalone dark theme**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T21:48:54Z
- **Completed:** 2026-03-20T21:57:22Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Button component with primary/secondary/destructive variants and sm/md/lg sizes with 44px touch target
- Haptic feedback utility with 4 patterns, all tests passing (5 tests)
- Service worker caching app shell on install, network-first for API, tile CDN caching
- PWA manifest updated with #0a0a0a theme, standalone display, portrait orientation
- OfflineBanner with motion AnimatePresence that auto-shows/hides on network status change
- PWAProvider wraps layout with SW registration and OfflineBanner rendering

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing haptics tests** - `7404a36` (test)
2. **Task 1 GREEN: Button, haptics, OfflineBanner** - `5fc56e3` (feat)
3. **Task 2: SW, manifest, layout, globals.css** - `50b88af` (feat)

## Files Created/Modified
- `src/components/ui/Button.tsx` - Shared button with variant/size props
- `src/lib/haptics.ts` - Vibration pattern utility with feature detection
- `src/lib/__tests__/haptics.test.ts` - 5 unit tests for haptic patterns
- `src/components/ui/OfflineBanner.tsx` - Network status banner with animation
- `public/sw.js` - Service worker with cache-first and network-first strategies
- `src/components/PWAProvider.tsx` - Client wrapper for SW registration and OfflineBanner
- `public/manifest.json` - Updated theme color, added scope and orientation
- `src/app/layout.tsx` - Added viewport export, apple-touch-icon, PWAProvider wrapper
- `src/app/globals.css` - Forced dark color-scheme, added safe-left/safe-right utilities
- `package.json` - Added motion dependency

## Decisions Made
- Used PWAProvider client wrapper pattern to embed client components inside server layout.tsx
- Installed motion package (not previously in project) for AnimatePresence in OfflineBanner
- Tile CDN caching uses separate cache bucket with 50-entry eviction limit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing motion dependency**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** motion/react import in OfflineBanner failed tsc --noEmit because motion package was not installed
- **Fix:** Ran npm install motion
- **Files modified:** package.json, package-lock.json
- **Verification:** npx tsc --noEmit passes clean
- **Committed in:** 50b88af (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential dependency installation. No scope creep.

## Issues Encountered
None beyond the motion dependency installation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Button component ready for Plan 02 to wire into existing dialogs
- OfflineBanner already rendering in layout via PWAProvider
- Service worker active on next deploy
- Haptic utility ready for integration into run controls

---
*Phase: 08-ui-ux-pwa-polish*
*Completed: 2026-03-20*
