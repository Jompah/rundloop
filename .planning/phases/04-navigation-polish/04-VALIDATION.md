---
phase: 4
slug: navigation-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

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
| 04-01-01 | 01 | 1 | NAV-01 | unit | `npx vitest run src/lib/__tests__/navigation.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | NAV-02 | unit | `npx vitest run src/lib/__tests__/navigation.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | NAV-03 | unit | `npx vitest run src/lib/__tests__/navigation.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | NAV-01 | manual | N/A — map rotation visual | N/A | ⬜ pending |
| 04-02-02 | 02 | 2 | NAV-04 | manual | N/A — mute/unmute UI | N/A | ⬜ pending |
| 04-02-03 | 02 | 2 | NAV-05 | manual | N/A — iOS Safari audio | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/navigation.test.ts` — stubs for NAV-01 (bearing calc), NAV-02 (deviation), NAV-03 (milestones)
- [ ] Vitest already installed — no framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Map auto-rotates with heading | NAV-01 | Requires device GPS heading + MapLibre visual | Walk/run with phone, confirm map rotates |
| Voice mute/unmute | NAV-04 | Audio playback verification | Toggle voice during run, confirm audio stops/resumes |
| iOS Safari PWA audio | NAV-05 | Requires iOS Safari standalone mode | Add to homescreen, start run, verify voice works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
