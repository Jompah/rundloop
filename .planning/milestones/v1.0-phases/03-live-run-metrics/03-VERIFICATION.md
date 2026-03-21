---
phase: 03-live-run-metrics
verified: 2026-03-20T10:03:00Z
status: human_needed
score: 13/13 automated must-haves verified
re_verification: false
human_verification:
  - test: "Visual glanceability of metrics overlay during active run"
    expected: "PACE in 48px green bold, AVG PACE/DISTANCE/TIME in 32px white bold, all readable at arm's length on a 375px mobile viewport"
    why_human: "Font size and contrast rendering cannot be verified programmatically"
  - test: "Metrics update cadence during active run"
    expected: "All metric values update smoothly driven by the 100ms timer from useRunSession"
    why_human: "Requires a running browser instance with GPS simulation or real GPS data"
  - test: "Pause state — overlay dims and values freeze"
    expected: "Overlay opacity drops to ~60%, PAUSED label appears, all metric values stop updating"
    why_human: "Animation and freeze behavior require a running browser instance"
  - test: "Resume — overlay returns to full opacity and metrics resume"
    expected: "Tap Resume, overlay becomes fully opaque again, metrics continue ticking"
    why_human: "State transition behavior requires a running browser instance"
  - test: "Unit label switching (km vs miles)"
    expected: "Change units in settings; pace shows /km vs /mi, distance shows km vs mi"
    why_human: "Settings persistence and unit label rendering require a running browser instance"
---

# Phase 03: Live Run Metrics Verification Report

**Phase Goal:** Runners see accurate, glanceable live stats during their run — the single most important screen in a running app
**Verified:** 2026-03-20T10:03:00Z
**Status:** human_needed (all automated checks passed; 5 items need human visual/functional testing)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computeRollingPace returns seconds-per-km for a 30-second trace window | VERIFIED | 20/20 tests pass; implementation at metrics.ts:8-48 |
| 2 | computeRollingPace returns null when fewer than 2 points or <1m distance | VERIFIED | Guard clauses at metrics.ts:12, 28, 41 confirmed by tests |
| 3 | computeAveragePace returns seconds-per-km from total distance and elapsed time | VERIFIED | Implementation at metrics.ts:55-63; test: 5000m/25min = 300 sec/km |
| 4 | formatPace renders M:SS /km or M:SS /mi string from seconds-per-km | VERIFIED | Implementation at metrics.ts:69-88; miles conversion via *1.60934 |
| 5 | formatPace returns '--:--' for null input | VERIFIED | metrics.ts:73; test confirms |
| 6 | formatMetricDistance converts meters to km or miles with 1 decimal | VERIFIED | metrics.ts:94-102; tests: 3200m -> "3.2" km, "2.0" mi |
| 7 | computeRemainingDistance clamps to zero when distance exceeds route length | VERIFIED | metrics.ts:107-112: Math.max(0, ...); test: 5500m covered on 5000m route -> 0 |
| 8 | formatElapsed produces MM:SS under 1 hour and H:MM:SS over 1 hour | VERIFIED | metrics.ts:117-127; tests: 90000ms -> "01:30", 3661000ms -> "1:01:01" |
| 9 | Runner sees current rolling pace in large 48px bold green text | VERIFIED (automated) | RunMetricsOverlay.tsx:67 — text-5xl font-bold text-green-400 |
| 10 | Runner sees average pace alongside rolling pace | VERIFIED | RunMetricsOverlay.tsx:75 — formatPace(avgPace, units) rendered |
| 11 | Runner sees total distance covered with 1 decimal precision | VERIFIED | RunMetricsOverlay.tsx:87 — formatMetricDistance(distanceMeters, units) |
| 12 | Runner sees elapsed time in MM:SS or H:MM:SS format | VERIFIED | RunMetricsOverlay.tsx:94 — formatElapsed(elapsedMs) |
| 13 | Runner sees remaining distance to finish, clamped to zero minimum | VERIFIED | RunMetricsOverlay.tsx:102 — computeRemainingDistance used, result rendered |
| 14 | All metrics respect settings.units preference (km/miles) | VERIFIED | units prop threaded through NavigationView -> RunMetricsOverlay; all format calls pass units |
| 15 | On pause, metrics overlay dims to opacity-60 with PAUSED label | VERIFIED (automated) | RunMetricsOverlay.tsx:51: opacity-60 applied when isPaused; PAUSED text at line 57 |
| 16 | Metrics arranged in 2x2 grid on bottom half of map | VERIFIED | RunMetricsOverlay.tsx: Row 1 (pace+avg), Row 2 (distance+time), Row 3 (remaining+progress), Row 4 (controls) |

**Score:** 16/16 automated truths verified; 5 require human confirmation (visual rendering quality)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/metrics.ts` | Pure metric computation and formatting functions | VERIFIED | 127 lines; all 6 functions exported: computeRollingPace, computeAveragePace, formatPace, formatMetricDistance, computeRemainingDistance, formatElapsed |
| `src/lib/__tests__/metrics.test.ts` | Unit tests covering all metric functions (min 80 lines) | VERIFIED | 145 lines; 20 tests across 6 describe blocks; all 20 pass |
| `src/components/RunMetricsOverlay.tsx` | Glanceable 2x2 metrics overlay component (min 60 lines) | VERIFIED | 154 lines; full component with all 4 rows + controls |
| `src/components/NavigationView.tsx` | Modified to render RunMetricsOverlay instead of inline stats | VERIFIED | Imports and renders RunMetricsOverlay; formatElapsed removed from local scope; async settings pattern applied |
| `src/app/page.tsx` | Passes trace and route to NavigationView | VERIFIED | trace={runSession.trace} at page.tsx:397 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/metrics.ts` | `src/lib/storage.ts` | import { haversineMeters } | WIRED | metrics.ts:2 — `import { haversineMeters } from './storage'`; used in computeRollingPace |
| `src/components/RunMetricsOverlay.tsx` | `src/lib/metrics.ts` | import { computeRollingPace, ... } | WIRED | RunMetricsOverlay.tsx:4-11 — all 6 functions imported; all used in render |
| `src/components/NavigationView.tsx` | `src/components/RunMetricsOverlay.tsx` | import and render | WIRED | NavigationView.tsx:8 imports; lines 153-173 render conditionally for active/paused |
| `src/app/page.tsx` | `src/components/NavigationView.tsx` | trace={runSession.trace} prop | WIRED | page.tsx:397 — `trace={runSession.trace}` confirmed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| METR-01 | 03-01, 03-02 | Current pace displayed as rolling lap pace (per-km average, not instantaneous GPS) | SATISFIED | computeRollingPace uses 30s sliding window summing haversineMeters; rendered in RunMetricsOverlay with formatPace |
| METR-02 | 03-01, 03-02 | Total distance covered displayed in real-time | SATISFIED | formatMetricDistance(distanceMeters, units) rendered in Row 2 of RunMetricsOverlay |
| METR-03 | 03-01, 03-02 | Elapsed time displayed (paused time excluded) | SATISFIED | formatElapsed(elapsedMs) rendered; elapsedMs sourced from useRunSession which already excludes paused time |
| METR-04 | 03-01, 03-02 | Remaining distance to finish displayed | SATISFIED | computeRemainingDistance clamped to 0; rendered in Row 3 with progress bar |
| METR-05 | 03-02 | Stats panel uses large fonts and high contrast, readable at a glance while running | SATISFIED (automated portion) | text-5xl (48px) for hero pace in green-400; text-3xl (32px) for secondary metrics in white; bg-gray-900/90 backdrop — visual quality needs human confirmation |

All 5 requirement IDs declared in plan frontmatter are accounted for. No orphaned requirements found for Phase 3 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

All `return null` occurrences in metrics.ts are intentional guard clauses documented by the plan's behavior spec, not stubs.

### TypeScript Compilation

Phase-owned files (`src/lib/metrics.ts`, `src/components/RunMetricsOverlay.tsx`) compile without errors. Pre-existing TypeScript errors exist in `src/components/RouteGenerator.tsx`, `src/components/SettingsView.tsx`, `src/lib/route-ai.ts`, and `src/app/page.tsx` (line 301) — all are from synchronous `getSettings()` calls outside this phase's scope and were documented as known issues in the 03-02 SUMMARY.

### Human Verification Required

#### 1. Visual glanceability at arm's length

**Test:** Open http://localhost:3000 on a 375px mobile viewport (Chrome DevTools), generate a route, start a run.
**Expected:** PACE metric displays in clearly large green text (48px), secondary metrics (AVG PACE, DISTANCE, TIME, REMAINING) in readable white text (32px). All labels are identifiable without squinting.
**Why human:** Font rendering size and contrast quality cannot be verified by static analysis.

#### 2. Metrics update cadence

**Test:** Start a run; observe all metric values for ~30 seconds.
**Expected:** TIME counts up every second; PACE and DISTANCE update as GPS position changes (or with mocked GPS data).
**Why human:** Requires a running browser instance with live re-render driven by the 100ms timer.

#### 3. Pause state behaviour

**Test:** During active run, tap Pause.
**Expected:** Overlay dims visibly (opacity-60 transition), "PAUSED" label appears with pulse animation, all metric values stop changing.
**Why human:** Animation and state freeze require a running browser.

#### 4. Resume behaviour

**Test:** From paused state, tap Resume.
**Expected:** Overlay opacity transitions back to full, PAUSED label disappears, metrics resume updating.
**Why human:** State transition and opacity transition require a running browser.

#### 5. Units switching

**Test:** In Settings, switch from km to miles (or vice versa). Return to an active run.
**Expected:** Pace labels show /mi vs /km, distance shows mi vs km, values are correctly converted.
**Why human:** Requires settings persistence and live component re-render.

### Gaps Summary

No automated gaps. All code is substantive and fully wired. The only open items are the 5 visual/runtime human verification checks above, which cannot be confirmed by static analysis.

---

_Verified: 2026-03-20T10:03:00Z_
_Verifier: Claude (gsd-verifier)_
