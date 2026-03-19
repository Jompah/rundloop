# Technology Stack

**Project:** RundLoop - Running PWA with GPS Navigation
**Researched:** 2026-03-19
**Mode:** Subsequent milestone (polish phase) -- existing stack is fixed

## Existing Stack (Do Not Change)

These are already integrated and working. Listed for reference only.

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.2.0 | App framework |
| React | 19.2.4 | UI library |
| Tailwind CSS | 4.x | Styling |
| MapLibre GL JS | 5.20.2 | Map rendering |
| OSRM | External API | Foot-routing |
| Claude Haiku | External API | AI route generation |
| Vercel | Hosting | Deployment |
| TypeScript | 5.x | Type safety |

## Recommended Additions

### Offline & PWA

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Manual service worker (`public/sw.js`) | N/A | App shell caching, offline support | Next.js 16 official docs recommend a hand-written `sw.js` registered manually. Serwist (v9.5.6) exists but requires webpack config and adds complexity for what RundLoop needs (cache app shell + API responses). A manual SW with Cache API gives full control over caching strategies without build-tool coupling. Push notifications are out of scope for Phase 1. | HIGH |
| idb-keyval | 6.2.2 | IndexedDB key-value storage | Current app uses localStorage which has a 5-10MB limit and blocks the main thread on large reads. Run history with GPS traces will exceed this quickly. idb-keyval is 573 bytes (brotli'd), promise-based, and handles IndexedDB boilerplate. No need for the heavier `idb` package (1.2KB) since RundLoop's data model is simple key-value (settings, routes, run history). | HIGH |

**Service worker caching strategy for RundLoop:**
- **App shell** (HTML, JS, CSS): Cache-first with network update (stale-while-revalidate)
- **Map tiles**: NOT cached offline (out of scope per PROJECT.md, storage/bandwidth complexity)
- **API responses** (OSRM routes): Cache with network-first strategy for repeat routes
- **Static assets** (icons, fonts): Cache-first, long-lived

### Animation & UI Polish

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Motion (formerly Framer Motion) | 12.x | Page transitions, gesture animations, layout animations | The project targets Runkeeper-quality polish. CSS animations alone cannot handle layout animations, gesture-driven interactions (swipe to dismiss, drag), or orchestrated sequences. Motion uses Web Animations API for 120fps performance and falls back to JS for spring physics. Import from `motion/react`. ~15KB gzip. | HIGH |

**Do NOT use:**
- `react-spring` -- Smaller ecosystem, less maintained, no layout animation support
- `@react-spring/web` -- Same limitations
- CSS-only animations -- Insufficient for gesture-driven interactions and coordinated sequences
- GSAP -- Overkill for a React app, licensing complexity, not React-idiomatic

### Geospatial Utilities

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @turf/helpers + @turf/distance + @turf/along + @turf/nearest-point-on-line | 7.3.4 (tree-shakeable) | Off-route detection, distance-along-route calculation, GPS snap-to-route | The app already has a manual haversine function in `storage.ts`. Navigation polish requires point-to-line distance (off-route detection), distance-along-line (progress tracking), and nearest-point-on-line (GPS snapping). Import individual @turf/* packages, NOT the full @turf/turf bundle (200KB+). Each sub-package is 1-3KB. | HIGH |

**Do NOT use:**
- `@turf/turf` (full bundle) -- 200KB+, includes dozens of unused modules
- Manual implementations -- Error-prone for edge cases (antimeridian, precision)

### GPX Export

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Manual GPX XML generation | N/A | Export routes as .gpx files | GPX is a simple XML format. The available npm packages (gpxparser, gpxjs) are focused on *parsing*, not generating. Writing GPX XML is ~30 lines of string templating for tracks with timestamps. No dependency needed. | HIGH |

Example shape:
```typescript
function generateGPX(points: {lat: number, lng: number, time: string}[], name: string): string {
  const trkpts = points.map(p =>
    `<trkpt lat="${p.lat}" lon="${p.lng}"><time>${p.time}</time></trkpt>`
  ).join('\n');
  return `<?xml version="1.0"?>
<gpx version="1.1" creator="RundLoop">
  <trk><name>${name}</name><trkseg>${trkpts}</trkseg></trk>
</gpx>`;
}
```

### Screen & Device APIs (No npm packages needed)

| API | Purpose | iOS Safari Support | Confidence |
|-----|---------|-------------------|------------|
| Wake Lock API | Keep screen on during navigation | iOS 16.4+, PWA bug fixed in iOS 18.4 | HIGH |
| Web Speech API (SpeechSynthesis) | Voice turn-by-turn guidance | Already integrated, iOS Safari supported | HIGH |
| Geolocation API (watchPosition) | GPS tracking during runs | Fully supported | HIGH |
| Vibration API | Haptic feedback on turns | NOT supported on iOS Safari | HIGH |

**Haptic feedback workaround for iOS:**

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| web-haptics | latest | Cross-platform haptic feedback | Uses hidden `<input type="checkbox" switch>` toggle trick to trigger iOS Safari's native haptic on switch controls (Safari 17.4+). Works on Android via standard Vibration API. Tiny package with React hook (`useWebHaptics`). | MEDIUM |

Confidence is MEDIUM because this is a relatively new package (March 2026 buzz) using an undocumented WebKit behavior. The `<input switch>` haptic could be removed by Apple. Fallback: audio feedback via Web Audio API (a short click sound).

### Route Visualization Enhancement

No additional packages needed. MapLibre GL JS 5.x already supports:

- **Line gradients** via `line-gradient` paint property (for elevation/pace coloring)
- **Symbols along lines** via `symbol-placement: 'line'` (for turn arrows)
- **GeoJSON sources** for dynamic route updates
- **Bearing/pitch** for 3D perspective during navigation
- **`map.easeTo()` / `map.flyTo()`** for smooth camera transitions

### Analytics & Metrics Display

No additional packages needed. Run metrics (pace, distance, time) are pure arithmetic on GPS data. For charts in the analytics/history view:

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Lightweight canvas chart (manual) | N/A | Pace trend sparklines, weekly summaries | Full charting libraries (Chart.js ~60KB, Recharts ~40KB) are overkill for 2-3 simple sparkline charts. A `<canvas>` sparkline renderer is ~50 lines. If analytics scope grows beyond sparklines, add Recharts later. | MEDIUM |

If analytics scope grows to include detailed interactive charts:
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| recharts | 2.x | Interactive charts (pace trends, elevation profiles) | React-native integration, composable, smaller than Chart.js with React wrapper. Only add if needed. | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Service Worker | Manual `sw.js` | Serwist (@serwist/next 9.5.6) | Requires webpack config in Next.js 16, adds build complexity for simple caching needs. Use Serwist only if offline-first requirements grow significantly. |
| IndexedDB | idb-keyval 6.2.2 | Dexie.js 4.x | Dexie adds ~25KB for a full query engine. RundLoop's data is simple key-value. idb-keyval is 573 bytes. |
| IndexedDB | idb-keyval 6.2.2 | localForage | Unmaintained (last release 2021), larger bundle, RundLoop already outgrew localStorage. |
| Animation | Motion 12.x | CSS transitions only | Cannot handle layout animations, gesture interactions, or orchestrated sequences needed for premium feel. |
| Animation | Motion 12.x | react-spring | Smaller ecosystem, no layout animation, less documentation. |
| Geospatial | @turf/* (tree-shaken) | Manual haversine | Existing haversine in storage.ts is fine for distance. But off-route detection, snap-to-line, and along-line calculations are too complex for manual implementation. |
| GPX export | Manual XML | gpx npm packages | Available packages are parsers, not generators. GPX generation is trivial string templating. |
| Charts | Manual canvas sparklines | Chart.js / Recharts | Overkill for MVP analytics. Add Recharts later if needed. |
| Haptics | web-haptics | No haptics | Haptic feedback significantly improves running UX (eyes-free turn confirmation). Worth the small risk of iOS workaround instability. |

## Installation

```bash
# New runtime dependencies
npm install idb-keyval motion @turf/helpers @turf/distance @turf/along @turf/nearest-point-on-line web-haptics

# No new dev dependencies needed
```

**Total bundle impact estimate:**
- idb-keyval: ~0.6KB brotli
- Motion: ~15KB gzip (tree-shaken for used features)
- @turf/* (4 packages): ~5KB total
- web-haptics: ~1KB
- **Total: ~22KB gzip added**

## Web API Compatibility Matrix (iOS Safari PWA)

Critical for RundLoop since primary target is iPhone PWA.

| API | iOS Safari | Min Version | Notes |
|-----|-----------|-------------|-------|
| Geolocation (watchPosition) | Yes | All | Works in PWA mode |
| Web Speech (SpeechSynthesis) | Yes | iOS 7+ | Already integrated |
| Wake Lock | Yes | iOS 16.4+ | PWA bug fixed iOS 18.4 |
| Service Worker | Yes | iOS 11.3+ | Limited to 50MB cache |
| IndexedDB | Yes | iOS 10+ | Works in PWA mode |
| Web Share API | Yes | iOS 15+ | For route sharing |
| Vibration API | No | N/A | Use web-haptics workaround |
| Background Sync | No | N/A | Not available on iOS |
| Periodic Background Sync | No | N/A | Not available on iOS |
| Push Notifications | Yes | iOS 16.4+ | Only when installed as PWA |

## Sources

- [Next.js PWA Guide (official, v16.2.0)](https://nextjs.org/docs/app/guides/progressive-web-apps) -- Verified 2026-03-19
- [idb-keyval npm](https://www.npmjs.com/package/idb-keyval) -- v6.2.2
- [Motion (formerly Framer Motion)](https://motion.dev/) -- v12.36.0
- [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide) -- framer-motion to motion migration
- [Turf.js](https://turfjs.org/) -- v7.3.4
- [Serwist](https://serwist.pages.dev/docs/next/getting-started) -- v9.5.6, considered but not recommended
- [Wake Lock API - Can I Use](https://caniuse.com/wake-lock) -- iOS 16.4+
- [Wake Lock API - WebKit bug fix](https://bugs.webkit.org/show_bug.cgi?id=254545) -- PWA fix in iOS 18.4
- [web-haptics GitHub](https://github.com/lochie/web-haptics) -- iOS haptic workaround
- [MapLibre GL JS npm](https://www.npmjs.com/package/maplibre-gl) -- v5.20.2 (already installed)
