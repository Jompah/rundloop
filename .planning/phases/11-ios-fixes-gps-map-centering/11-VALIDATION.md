---
phase: 11
slug: ios-fixes-gps-map-centering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | MAP-01, MAP-02, MAP-03 | unit | `npx vitest run src/hooks/__tests__/useMapCentering.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | MAP-01 | unit | `npx vitest run src/hooks/__tests__/useMapCentering.test.ts -t "GPS_LOCK"` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | MAP-02 | unit | `npx vitest run src/hooks/__tests__/useMapCentering.test.ts -t "RECENTER"` | ❌ W0 | ⬜ pending |
| 11-02-03 | 02 | 1 | MAP-03 | unit | `npx vitest run src/hooks/__tests__/useMapCentering.test.ts -t "transitions"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/__tests__/useMapCentering.test.ts` — stubs for MAP-01, MAP-02, MAP-03 (tests pure reducer logic: state transitions, GPS_LOCK, USER_PAN, RECENTER, START/STOP_NAVIGATION)

*Existing infrastructure covers IOS-01, IOS-02, IOS-03 (pre-completed).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Map renders on iOS Safari | IOS-01 | Requires iOS device | Pre-completed — already verified |
| UI not overlapped by tab bar | IOS-02 | Requires iOS device | Pre-completed — already verified |
| GPS permission retry flow | IOS-03 | Requires GPS permission UI | Pre-completed — already verified |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
