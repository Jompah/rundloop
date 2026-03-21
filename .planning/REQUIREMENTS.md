# Requirements: RundLoop

**Defined:** 2026-03-21
**Core Value:** Runners see the entire loop route upfront before taking a single step

## v1.1 Requirements

Requirements for v1.1 milestone (Route Quality & Map UX). Each maps to roadmap phases.

### Map UX

- [ ] **MAP-01**: Map auto-centers on user GPS position on app open
- [ ] **MAP-02**: "Center on me" button visible on map to re-center anytime
- [ ] **MAP-03**: Map centering state machine (auto-rotate during nav vs free-pan vs centered)

### Route Quality

- [ ] **ROUTE-01**: Route mode toggle in UI (Nature / Explore / Standard)
- [ ] **ROUTE-02**: Nature mode generates routes through parks, waterfronts, and green areas
- [ ] **ROUTE-03**: Explore mode generates routes past landmarks and touristy viewpoints
- [ ] **ROUTE-04**: AI prompt composition adapts waypoint selection to chosen route mode
- [ ] **ROUTE-05**: Overpass API provides real POI coordinates for Nature mode waypoints
- [ ] **ROUTE-06**: Server-side POI caching to avoid Overpass rate limits
- [ ] **ROUTE-07**: Graceful fallback to standard routing when POI data is sparse

### Flexible Start

- [ ] **START-01**: Route can start within 300m of user GPS position (not forced to exact location)
- [ ] **START-02**: Walking segment from GPS to route start shown on map

### iOS Fixes

- [x] **IOS-01**: Map renders correctly on iOS Safari (no black screen)
- [x] **IOS-02**: UI elements not overlapped by bottom tab bar
- [x] **IOS-03**: Explicit GPS permission flow (retry/simulate instead of silent fallback)

## Future Requirements

### Route Quality Enhancements

- **ROUTE-08**: User can rate route quality after a run
- **ROUTE-09**: Route avoidance zones (busy roads, hills)
- **ROUTE-10**: Elevation-aware routing (prefer flat / prefer hilly toggle)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom waypoint editing | High complexity, defer to v1.2+ |
| Offline POI caching | IndexedDB storage budget constraints, defer |
| Multiple POI providers (Google Places) | Overpass sufficient for v1.1, commercial API adds cost |
| Heart rate monitoring | Phase 2+, high complexity |
| User accounts | Phase 3 (SaaS) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MAP-01 | Phase 11 | Pending |
| MAP-02 | Phase 11 | Pending |
| MAP-03 | Phase 11 | Pending |
| ROUTE-01 | Phase 12 | Pending |
| ROUTE-02 | Phase 13 | Pending |
| ROUTE-03 | Phase 13 | Pending |
| ROUTE-04 | Phase 12 | Pending |
| ROUTE-05 | Phase 15 | Pending |
| ROUTE-06 | Phase 15 | Pending |
| ROUTE-07 | Phase 15 | Pending |
| START-01 | Phase 14 | Pending |
| START-02 | Phase 14 | Pending |
| IOS-01 | Phase 11 | Complete (pre-committed) |
| IOS-02 | Phase 11 | Complete (pre-committed) |
| IOS-03 | Phase 11 | Complete (pre-committed) |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation*
