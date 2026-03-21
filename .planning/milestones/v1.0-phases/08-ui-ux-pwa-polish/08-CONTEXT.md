# Phase 8: UI/UX & PWA Polish - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Final polish pass: establish consistent design system across all screens, add fluid page transitions with Motion library, implement haptic feedback on key interactions, optimize for iPhone viewport (375-430px), and add service worker for offline-capable PWA.

</domain>

<decisions>
## Implementation Decisions

### Design System & Animations
- Motion library (framer-motion successor) for page transitions — fluid, native-feel animations
- Animate: view switches (map→history→routes), dialog open/close, summary fade-in — key moments only
- Full design system audit: consistent typography (4 sizes), spacing (8pt grid), button styles, color usage across all screens
- Extract shared Button component with primary/secondary/destructive variants — reuse everywhere

### Haptic Feedback & Mobile Viewport
- Haptics on: start run, pause, resume, end run, milestone announcement, off-route alert — high-impact moments
- Haptic patterns: short vibrate (50ms) for buttons, double-pulse (100,50,100) for milestones, triple for off-route
- Full viewport audit at 375px width: fix overflow, ensure touch targets ≥44px, safe-area padding
- Use `env(safe-area-inset-*)` CSS variables consistently via existing `.safe-bottom` utility pattern

### PWA & Service Worker
- Cache app shell (HTML, JS, CSS) on install, network-first for API calls
- Cache: app shell + static assets + dark map tiles (first ~50 tiles) — enough for offline startup
- PWA manifest with app name "Rundloop", icons, theme-color #0a0a0a, standalone display mode
- Small "Offline" banner when network unavailable — non-blocking, auto-dismiss on reconnect

### Claude's Discretion
- Exact animation durations and easing curves
- Button component API design (props, variants)
- Service worker cache versioning strategy
- Offline banner positioning and styling
- Which specific screens need viewport fixes (audit will determine)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Dark theme established: bg-gray-900, text-white, green-400 accent across all components
- `navigator.vibrate()` already used in NavigationView for step changes
- `.safe-bottom` CSS utility in globals.css
- Tailwind 4 + postcss for all styling
- Next.js app router with page.tsx as main orchestrator

### Established Patterns
- All dialogs follow DiscardConfirmDialog pattern (dark bg, rounded, two-button)
- TabBar with 3 tabs, icon+label, green-400 active state
- View switching via AppView state type in page.tsx
- Settings loaded async via useState + useEffect

### Integration Points
- Motion needs wrapping view containers for AnimatePresence
- Service worker registered in app layout or page component
- manifest.json in public/ directory
- Haptic utility function needed (centralize vibrate patterns)
- Button component replaces inline button styles across ~15 components

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
