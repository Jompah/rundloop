---
phase: 3
slug: live-run-metrics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

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
| 03-01-01 | 01 | 1 | METR-01 | unit | `npx vitest run src/lib/__tests__/metrics.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | METR-02 | unit | `npx vitest run src/lib/__tests__/metrics.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | METR-03 | unit | `npx vitest run src/lib/__tests__/metrics.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | METR-04 | unit | `npx vitest run src/lib/__tests__/metrics.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | METR-05 | manual | N/A — visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/metrics.test.ts` — stubs for METR-01 through METR-04
- [ ] Vitest already installed — no framework install needed

*Existing vitest infrastructure covers test execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Large fonts, high contrast, glanceable at pace | METR-05 | Visual/UX quality | View metrics overlay on mobile viewport, verify readability at arm's length |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
