# Phase 8: UI/UX & PWA Polish - Research

**Researched:** 2026-03-20
**Domain:** Design system, animations, haptic feedback, PWA/service worker
**Confidence:** HIGH

## Summary

Phase 8 is a polish pass across three domains: (1) design system consistency with shared Button component and typography audit, (2) fluid animations via Motion library (framer-motion successor) for view transitions, and (3) PWA infrastructure with service worker caching and manifest updates. The codebase already has strong dark-mode foundations (bg-gray-900, green-400 accent, safe-area utilities) and an established dialog pattern that makes the Button extraction straightforward.

The Motion library (v12.x) is the renamed framer-motion and works with React 19 / Next.js 16. It provides AnimatePresence for exit animations and the `motion` component for declarative transitions. The service worker will be a hand-written `public/sw.js` file (Next.js 16 official PWA guide recommends this approach) using cache-first for static assets and network-first for API calls. The Vibration API now works on iOS 18+ Safari, though feature detection remains essential.

**Primary recommendation:** Use `motion` (v12.x) for animations, hand-written `public/sw.js` for service worker, centralized `haptics.ts` utility wrapping navigator.vibrate with pattern presets, and a shared `Button` component with 3 variants extracted from the existing dialog pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Motion library (framer-motion successor) for page transitions -- fluid, native-feel animations
- Animate: view switches (map->history->routes), dialog open/close, summary fade-in -- key moments only
- Full design system audit: consistent typography (4 sizes), spacing (8pt grid), button styles, color usage across all screens
- Extract shared Button component with primary/secondary/destructive variants -- reuse everywhere
- Haptics on: start run, pause, resume, end run, milestone announcement, off-route alert -- high-impact moments
- Haptic patterns: short vibrate (50ms) for buttons, double-pulse (100,50,100) for milestones, triple for off-route
- Full viewport audit at 375px width: fix overflow, ensure touch targets >=44px, safe-area padding
- Use `env(safe-area-inset-*)` CSS variables consistently via existing `.safe-bottom` utility pattern
- Cache app shell (HTML, JS, CSS) on install, network-first for API calls
- Cache: app shell + static assets + dark map tiles (first ~50 tiles) -- enough for offline startup
- PWA manifest with app name "Rundloop", icons, theme-color #0a0a0a, standalone display mode
- Small "Offline" banner when network unavailable -- non-blocking, auto-dismiss on reconnect

### Claude's Discretion
- Exact animation durations and easing curves
- Button component API design (props, variants)
- Service worker cache versioning strategy
- Offline banner positioning and styling
- Which specific screens need viewport fixes (audit will determine)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Dark mode default with consistent design system | Design system audit findings, typography scale, spacing grid, Button component pattern |
| UI-02 | Fluid animations between screens (Motion library) | Motion v12.x AnimatePresence pattern, view transition code examples |
| UI-03 | Haptic feedback on key interactions | haptics.ts utility with pattern presets, iOS 18+ Vibration API support |
| UI-04 | Mobile-first responsive design for iPhone 375-430px | Viewport audit checklist, touch target sizing, safe-area patterns |
| UI-05 | Clean minimal interface with premium feel | Button component extraction, consistent dialog pattern, animation restraint |
| PWA-01 | Service worker caches app shell for offline loading | public/sw.js with cache-first static + network-first API strategy |
| PWA-02 | App icon and splash screen for iOS Safari Add to Home Screen | Manifest configuration, apple-touch-icon, apple-web-app-capable meta |
| PWA-03 | Standalone display mode (no Safari chrome) | manifest.json display: standalone + apple-web-app-capable in layout.tsx |
| PWA-04 | Smooth 60fps during map rendering and navigation | Motion hardware-accelerated transforms, will-change optimization |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.38.0 | React animations (AnimatePresence, motion components) | Official successor to framer-motion, hardware-accelerated, React 19 compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none -- hand-written) | - | Service worker (public/sw.js) | Next.js 16 official PWA guide recommends hand-written SW |
| (none -- hand-written) | - | Haptic utility (src/lib/haptics.ts) | Thin wrapper around navigator.vibrate, no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| motion | CSS animations only | Motion provides AnimatePresence for exit animations which CSS cannot do; also declarative variants API |
| Hand-written SW | Serwist (next-pwa successor) | Serwist requires webpack config; overkill for app-shell-only caching; Next.js docs note this limitation |
| Hand-written SW | Workbox | Heavy dependency for simple cache-first/network-first; hand-written is ~60 lines |

**Installation:**
```bash
npm install motion
```

**Version verification:** motion@12.38.0 confirmed via npm registry 2026-03-20.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    ui/
      Button.tsx          # Shared button (primary/secondary/destructive)
      OfflineBanner.tsx    # Network status indicator
    ...existing components
  lib/
    haptics.ts            # Vibration patterns utility
  app/
    manifest.ts           # Next.js dynamic manifest (replaces public/manifest.json)
    layout.tsx            # Add SW registration, apple-web-app meta
public/
  sw.js                   # Service worker
  icon-192.png            # PWA icon 192x192
  icon-512.png            # PWA icon 512x512
  apple-touch-icon.png    # iOS home screen icon (180x180)
```

### Pattern 1: View Transitions with AnimatePresence
**What:** Wrap view switching in page.tsx with AnimatePresence for enter/exit animations
**When to use:** Tab switches (generate/history/routes), dialog open/close, summary fade-in
**Example:**
```typescript
// Source: motion.dev/docs/react (AnimatePresence)
import { AnimatePresence, motion } from 'motion/react';

// In page.tsx, wrap the view content:
<AnimatePresence mode="wait">
  {view === 'generate' && (
    <motion.div
      key="generate"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <RouteGenerator ... />
    </motion.div>
  )}
  {view === 'history' && (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <RunHistoryView ... />
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 2: Centralized Haptic Feedback
**What:** Single utility with named patterns, feature detection, and no-op fallback
**When to use:** All haptic trigger points (start run, pause, milestone, off-route)
**Example:**
```typescript
// src/lib/haptics.ts
type HapticPattern = 'tap' | 'success' | 'milestone' | 'warning';

const patterns: Record<HapticPattern, number | number[]> = {
  tap: 50,                    // Short single pulse for buttons
  success: [50, 50, 50],     // Double pulse for start/end run
  milestone: [100, 50, 100], // Longer double for km milestones
  warning: [100, 50, 100, 50, 100], // Triple for off-route
};

export function haptic(pattern: HapticPattern): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(patterns[pattern]);
  }
}
```

### Pattern 3: Button Component with Variants
**What:** Shared button extracted from existing dialog pattern
**When to use:** Replace all inline button styles across ~15 components
**Example:**
```typescript
// src/components/ui/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const variantClasses = {
  primary: 'bg-green-500 text-white active:bg-green-600',
  secondary: 'bg-gray-800 text-white active:bg-gray-700',
  destructive: 'bg-red-500 text-white active:bg-red-600',
};

const sizeClasses = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function Button({ variant = 'primary', size = 'md', fullWidth, className, ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-xl font-semibold ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className || ''}`}
      {...props}
    />
  );
}
```

### Pattern 4: Service Worker with Cache Versioning
**What:** Hand-written SW in public/sw.js with install-time precaching and runtime caching
**Example:**
```javascript
// public/sw.js
const CACHE_NAME = 'rundloop-v1';
const APP_SHELL = [
  '/',
  '/manifest.json',
  // Next.js will generate hashed JS/CSS files; we cache on fetch instead
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for API calls
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for app shell and static assets
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
    )
  );
});
```

### Anti-Patterns to Avoid
- **Animating everything:** Only animate key moments (view switches, dialogs, summary). Animating every list item or button causes jank and feels gimmicky.
- **Heavy exit animations:** Keep exit animations fast (<200ms). Users switching tabs expect instant feedback.
- **Caching map tiles aggressively:** Map tiles from external CDNs change; cache only first ~50 dark tiles viewed, not all zoom levels.
- **Synchronous haptics in render:** Always call haptic() in event handlers, never during render.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exit animations | CSS animation + manual DOM removal | Motion AnimatePresence | Correctly handles unmount timing, prevents flash-of-removed-content |
| Spring physics | Custom spring math | Motion transition type="spring" | Perceptually correct spring physics with damping/stiffness |
| Gesture detection | Custom touch handlers | Motion gesture props (whileTap, drag) | Handles edge cases (multi-touch, scroll vs tap) |
| Cache invalidation | Custom versioning logic | SW CACHE_NAME version bump | Standard pattern, well-understood lifecycle |

**Key insight:** Motion handles the hard parts of animation (exit timing, layout animations, gesture → animation coordination). The service worker is simple enough to hand-write; a library would add complexity without benefit for this scope.

## Common Pitfalls

### Pitfall 1: Motion import path
**What goes wrong:** Importing from `framer-motion` instead of `motion/react`
**Why it happens:** Old tutorials and training data reference the old package name
**How to avoid:** Always use `import { motion, AnimatePresence } from 'motion/react'`
**Warning signs:** Build error about missing module

### Pitfall 2: AnimatePresence requires key prop
**What goes wrong:** Views don't animate on switch because children lack unique keys
**Why it happens:** AnimatePresence tracks children by key to know when to run exit animations
**How to avoid:** Every child of AnimatePresence must have a unique `key` prop matching the current view
**Warning signs:** No exit animation plays, content just disappears

### Pitfall 3: Service worker caching Next.js dynamic chunks
**What goes wrong:** SW caches old JS chunks, app loads stale code after deployment
**Why it happens:** Next.js uses content-hashed chunk names; old cached responses served for new requests
**How to avoid:** Bump CACHE_NAME on deploy; activate event cleans old caches. Cache-first with stale cache cleanup on version change.
**Warning signs:** App behavior doesn't match latest deploy

### Pitfall 4: iOS Safari Vibration API inconsistency
**What goes wrong:** navigator.vibrate exists but silently fails on older iOS versions
**Why it happens:** iOS 18+ added vibration support; older versions have no support at all
**How to avoid:** Feature-detect with `typeof navigator !== 'undefined' && 'vibrate' in navigator`; treat as progressive enhancement (never block on vibration)
**Warning signs:** No haptic feedback on some iOS devices; no error thrown

### Pitfall 5: Viewport overflow from absolute positioning
**What goes wrong:** Horizontal scroll appears on iPhone SE (375px) due to elements positioned outside viewport
**Why it happens:** Absolute/fixed positioned elements with hardcoded widths or margins
**How to avoid:** Audit all components at 375px width; use `max-w-full` and `overflow-hidden` on root; ensure no element exceeds 100vw
**Warning signs:** Horizontal scrollbar visible on mobile

### Pitfall 6: Safe area double-padding
**What goes wrong:** Bottom content gets excessive padding when both TabBar and content apply safe-area
**Why it happens:** Multiple elements using `env(safe-area-inset-bottom)` stack up
**How to avoid:** Only the outermost fixed-bottom element (TabBar) should apply safe-area padding
**Warning signs:** Large gap at bottom of screen on iPhone with home indicator

### Pitfall 7: AnimatePresence mode="wait" blocks rendering
**What goes wrong:** New view doesn't render until exit animation completes, feels sluggish
**Why it happens:** `mode="wait"` serializes exit then enter. With slow exit animations this adds latency
**How to avoid:** Keep exit animations very fast (100-150ms) or use `mode="popLayout"` for cross-fade
**Warning signs:** View switch feels delayed compared to instant tab switching

## Code Examples

### Service Worker Registration in layout.tsx
```typescript
// In layout.tsx or a client component loaded from layout
// Source: Next.js 16 PWA guide (node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md)

// Register in a useEffect in page.tsx or a dedicated component:
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  }
}, []);
```

### Dynamic Manifest (app/manifest.ts)
```typescript
// Source: Next.js 16 PWA guide
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rundloop',
    short_name: 'Rundloop',
    description: 'AI-powered running route generator',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
```

### Offline Banner Component
```typescript
// src/components/ui/OfflineBanner.tsx
'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-center text-sm py-2 font-medium safe-top"
        >
          Offline
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Dialog Animation Pattern
```typescript
// Wrap existing dialog backdrop + content with motion
<AnimatePresence>
  {showDialog && (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {/* Dialog content */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { motion } from 'framer-motion'` | `import { motion } from 'motion/react'` | 2024 (Motion v11+) | Package renamed, old import still works via compatibility but new import preferred |
| next-pwa (abandoned) | Hand-written SW or Serwist | 2023 | next-pwa no longer maintained; Serwist is successor but requires webpack |
| iOS has no Vibration API | iOS 18+ supports navigator.vibrate | 2024 (iOS 18) | Can now use haptics on iPhone, but must feature-detect |
| public/manifest.json | app/manifest.ts (Next.js file convention) | Next.js 13+ | Dynamic manifest generation, type-safe, but static JSON also works |

**Deprecated/outdated:**
- `framer-motion` package name: Still works but `motion` is the current name
- `next-pwa`: Abandoned, do not use
- Assuming iOS cannot vibrate: iOS 18+ supports it

## Open Questions

1. **PWA Icons generation**
   - What we know: manifest.json references icon-192.png and icon-512.png which don't exist in public/ yet
   - What's unclear: Whether to generate placeholder icons or use a favicon generator
   - Recommendation: Create simple solid-color placeholder icons with the Rundloop "R" text; proper branding can come later

2. **Map tile caching scope**
   - What we know: CONTEXT.md says "first ~50 tiles" for dark map tiles
   - What's unclear: How to intercept and selectively cache tile requests from MapLibre's tile CDN
   - Recommendation: In the SW fetch handler, check for tile URL patterns (e.g., containing /tiles/ or known tile CDN hostnames) and cache up to a byte limit (~5MB). Use a separate cache name for tiles with LRU eviction.

3. **60fps during map navigation (PWA-04)**
   - What we know: MapLibre handles its own WebGL rendering; Motion animations use hardware-accelerated transforms
   - What's unclear: Whether there are specific jank points during navigation
   - Recommendation: This requirement is largely addressed by using transform-based animations (not layout triggers) and keeping the Motion animation scope small. Profile if issues arise.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Design system consistency (Button variants) | unit | `npx vitest run src/components/ui/__tests__/Button.test.ts -x` | No - Wave 0 |
| UI-02 | Motion animations render | manual-only | Manual: verify animations in browser | N/A (visual) |
| UI-03 | Haptic patterns fire correctly | unit | `npx vitest run src/lib/__tests__/haptics.test.ts -x` | No - Wave 0 |
| UI-04 | Viewport 375px no overflow | manual-only | Manual: Chrome DevTools responsive mode | N/A (visual) |
| UI-05 | Clean interface | manual-only | Manual: visual review | N/A (visual) |
| PWA-01 | SW caches app shell | unit | `npx vitest run src/lib/__tests__/sw.test.ts -x` | No - Wave 0 |
| PWA-02 | Manifest configured correctly | unit | `npx vitest run src/app/__tests__/manifest.test.ts -x` | No - Wave 0 |
| PWA-03 | Standalone display mode | manual-only | Manual: Add to Home Screen on iOS | N/A |
| PWA-04 | 60fps interactions | manual-only | Manual: Chrome DevTools Performance tab | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/ui/__tests__/Button.test.ts` -- covers UI-01
- [ ] `src/lib/__tests__/haptics.test.ts` -- covers UI-03
- [ ] `src/lib/__tests__/sw.test.ts` -- covers PWA-01 (mock SW lifecycle)
- [ ] `src/app/__tests__/manifest.test.ts` -- covers PWA-02 (validate manifest output)

## Sources

### Primary (HIGH confidence)
- Next.js 16 PWA guide (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`) - SW registration, manifest, caching
- motion v12.38.0 (npm registry, verified 2026-03-20) - current version
- Existing codebase analysis - dialog patterns, navigator.vibrate usage, globals.css, layout.tsx

### Secondary (MEDIUM confidence)
- [Motion for React docs](https://motion.dev/docs/react) - AnimatePresence, motion component API
- [MDN Navigator.vibrate](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) - API reference
- [MDN Caching guide for PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching) - caching strategies
- [Can I Use - navigator.vibrate](https://caniuse.com/mdn-api_navigator_vibrate) - browser support table

### Tertiary (LOW confidence)
- [mdn/browser-compat-data issue #29166](https://github.com/mdn/browser-compat-data/issues/29166) - iOS 18 vibration support (community report, not official Apple documentation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - motion v12.38.0 verified on npm, Next.js 16 PWA guide read directly from local docs
- Architecture: HIGH - patterns derived from existing codebase patterns and official docs
- Pitfalls: HIGH - based on established React animation and PWA knowledge, verified against current docs
- Haptics/iOS: MEDIUM - iOS 18 vibration support confirmed by multiple community sources but no official Apple documentation found

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days - stable domain, Motion and Next.js versions unlikely to change)
