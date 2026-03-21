---
phase: 8
slug: ui-ux-pwa-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | UI-03 | unit | `npx vitest run src/lib/__tests__/haptics.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | UI-01 | manual | N/A — visual consistency | N/A | ⬜ pending |
| 08-02-02 | 02 | 2 | UI-02 | manual | N/A — animation quality | N/A | ⬜ pending |
| 08-03-01 | 03 | 2 | PWA-01, PWA-02 | manual | N/A — offline behavior | N/A | ⬜ pending |
| 08-03-02 | 03 | 2 | UI-04 | manual | N/A — viewport at 375px | N/A | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/haptics.test.ts` — stubs for haptic utility
- [ ] Vitest already installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Design system consistency | UI-01 | Visual audit across screens | Review all screens for typography, color, button consistency |
| Motion animations | UI-02 | Animation quality | Navigate between views, verify smooth transitions |
| Haptic feedback | UI-03 | Device hardware needed | Test on iOS/Android, verify vibrations on key actions |
| iPhone viewport | UI-04 | Device viewport needed | Test at 375px, verify no overflow |
| Service worker offline | PWA-01 | Network conditions | Disable network, verify app loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
