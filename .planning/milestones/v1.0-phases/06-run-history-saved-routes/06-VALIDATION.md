---
phase: 6
slug: run-history-saved-routes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 6 — Validation Strategy

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
| 06-01-01 | 01 | 1 | HIST-01 | unit | `npx vitest run src/lib/__tests__/thumbnail.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | HIST-01, HIST-02 | manual | N/A — UI list + detail view | N/A | ⬜ pending |
| 06-02-02 | 02 | 2 | HIST-03 | manual | N/A — delete flow | N/A | ⬜ pending |
| 06-03-01 | 03 | 2 | ROUT-01, ROUT-02 | manual | N/A — save route flow | N/A | ⬜ pending |
| 06-03-02 | 03 | 2 | ROUT-03, ROUT-04 | manual | N/A — load saved route | N/A | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/thumbnail.test.ts` — stubs for thumbnail generation
- [ ] Vitest already installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| History list with thumbnails | HIST-01 | Canvas rendering + IndexedDB | Complete runs, check history list |
| Run detail overlay | HIST-02 | MapLibre visual | Tap a run, verify map + stats |
| Delete run | HIST-03 | UI flow | Delete run, verify removed |
| Save route with name | ROUT-01, ROUT-02 | UI flow | Generate route, save, check list |
| Load saved route | ROUT-03, ROUT-04 | Navigation flow | Tap Run on saved route, verify loaded |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
