---
phase: 1
slug: storage-gps-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 (not yet installed — Wave 0) |
| **Config file** | None — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | GPS-01 | unit | `npx vitest run src/lib/__tests__/gps-filter.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | GPS-02 | unit | `npx vitest run src/lib/__tests__/gps-filter.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | GPS-03 | unit | `npx vitest run src/lib/__tests__/wake-lock.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | GPS-04 | unit | `npx vitest run src/lib/__tests__/db.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | STOR-01 | unit | `npx vitest run src/lib/__tests__/db.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | STOR-02 | unit | `npx vitest run src/lib/__tests__/db.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | STOR-03 | unit | `npx vitest run src/lib/__tests__/db.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | STOR-04 | unit | `npx vitest run src/lib/__tests__/db.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest fake-indexeddb` — test framework and IndexedDB mock
- [ ] `vitest.config.ts` — basic config with path aliases matching tsconfig
- [ ] `src/lib/__tests__/gps-filter.test.ts` — GPS filter unit test stubs for GPS-01, GPS-02
- [ ] `src/lib/__tests__/wake-lock.test.ts` — Wake Lock manager test stubs for GPS-03
- [ ] `src/lib/__tests__/db.test.ts` — IndexedDB CRUD test stubs for GPS-04, STOR-01..04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wake Lock keeps screen on during run | GPS-03 | Requires real device screen behavior | Start run on iOS Safari PWA, verify screen stays on for 2+ minutes |
| Storage persistence survives 7-day inactivity | STOR-03 | Requires waiting 7 days on real device | Request persistence, wait 7 days, check if data survives |
| GPS filtering works in real-world urban environment | GPS-01 | Real GPS noise patterns can't be simulated | Run 1km with app, verify no phantom distance spikes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
