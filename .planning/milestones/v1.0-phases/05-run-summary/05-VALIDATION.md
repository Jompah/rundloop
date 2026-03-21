---
phase: 5
slug: run-summary
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 5 — Validation Strategy

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
| 05-01-01 | 01 | 1 | SUMM-04 | unit | `npx vitest run src/lib/__tests__/calories.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | SUMM-01 | manual | N/A — visual summary screen | N/A | ⬜ pending |
| 05-02-02 | 02 | 2 | SUMM-02 | manual | N/A — map trace overlay | N/A | ⬜ pending |
| 05-02-03 | 02 | 2 | SUMM-03 | manual | N/A — save/discard flow | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/calories.test.ts` — stubs for SUMM-04 calorie calculation
- [ ] Vitest already installed — no framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Summary screen shows stats after run | SUMM-01 | Full run lifecycle needed | Complete a run, verify stats display |
| GPS trace + route overlay on map | SUMM-02 | MapLibre visual rendering | Complete a run, verify both lines visible |
| Save/discard flow works | SUMM-03 | UI interaction flow | Save run, check history; discard run, verify deleted |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
