# Phase 9: Cross-Phase Wiring Fixes - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 4 cross-phase data flow issues identified by milestone audit: save route polyline with CompletedRun, propagate units setting to history/detail views, use estimateCalories() in RunDetailOverlay, seed RouteGenerator distance from settings.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/wiring phase. Fixes are specified in the audit report.

</decisions>

<code_context>
## Existing Code Insights

### Fixes Needed (from v1.0-MILESTONE-AUDIT.md)
1. **routePolyline**: Augment CompletedRun in page.tsx endRun handler with route?.polyline before IndexedDB save; pass route?.id to startRun()
2. **Units in RunHistoryView**: Add getSettings() load, pass units to formatMetricDistance/formatPace calls (lines 98, 101)
3. **Units in RunDetailOverlay**: Add getSettings() load, pass units to formatMetricDistance/formatPace (lines 163, 176)
4. **Calories in RunDetailOverlay**: Replace hardcoded 60 kcal/km (line 124) with estimateCalories() + settings.bodyWeightKg
5. **defaultDistance in RouteGenerator**: Seed distance state from getSettings().defaultDistance on mount

</code_context>

<specifics>
## Specific Ideas

No specific requirements — fixes are fully specified by the audit.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
