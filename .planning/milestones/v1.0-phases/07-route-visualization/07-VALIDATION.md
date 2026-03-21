---
phase: 7
slug: route-visualization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | VIZ-02 | unit | `npx vitest run src/lib/__tests__/elevation.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | VIZ-01, VIZ-02, VIZ-05 | manual | N/A — MapLibre visual | N/A | ⬜ pending |
| 07-02-02 | 02 | 2 | VIZ-03 | manual | N/A — marker visual | N/A | ⬜ pending |
| 07-02-03 | 02 | 2 | VIZ-04 | manual | N/A — turn arrows visual | N/A | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/elevation.test.ts` — stubs for elevation fetch and grade computation
- [ ] Vitest already installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smooth anti-aliased route lines | VIZ-01 | GL rendering quality | Generate route, zoom in, verify smoothness |
| Elevation gradient coloring | VIZ-02 | Visual color gradient | Generate route with elevation change, verify green→red |
| Start/finish markers | VIZ-03 | MapLibre marker rendering | Generate route, verify markers at endpoints |
| Turn indicators | VIZ-04 | Symbol layer rendering | Generate route with turns, verify directional arrows |
| Dark mode OLED palette | VIZ-05 | Visual inspection | View on dark background, verify contrast and colors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
