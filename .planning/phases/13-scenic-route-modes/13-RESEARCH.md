# Phase 13: Scenic Route Modes - Research

**Researched:** 2026-03-24
**Status:** Complete

## Current State (Post Phase 12)

Phase 12 established:
- `ScenicMode` type: `'standard' | 'nature' | 'explore'`
- `SCENIC_INSTRUCTIONS` map with per-mode prompt instructions
- `buildRoutePrompt()` composable prompt function
- UI toggle in RouteGenerator (Standard / Natur / Utforska)
- Persistence in IndexedDB

The prompts exist but have not been empirically validated. Phase 13 focuses on making scenic modes produce visibly different, high-quality routes.

## Key Improvements Needed

### 1. Enhanced Scenic Prompts for City Centers
Current prompts are generic. For Nature mode in a city center (e.g., Stockholm Gamla Stan), the AI might not know which specific parks or waterfront paths exist. The prompt should:
- Instruct the AI to name specific places it routes through
- Ask for waypoints that are geographically spread (not clustered)
- Request labels on waypoints for user visibility

### 2. Waypoint Geographic Spread
Current issue: AI might generate waypoints that cluster in one area, creating monotonous routes.
Solution: Add prompt instructions to spread waypoints across different compass directions from the start point.

### 3. Street Dedup Threshold
Current threshold: 15% (`DEDUP_THRESHOLD = 0.15`)
User request: Lower to 10% for better variation.
This is a simple constant change in `src/lib/street-dedup.ts`.

### 4. Waypoint Labels
The `RouteWaypoint` type already supports `label?: string`, but the AI response parsing (`parseWaypoints`) only extracts `lat` and `lng`. Need to also extract `label` from the AI response and add prompt instructions to include labels.

## Implementation Plan

### Prompt Enhancements
1. Add geographic spread instruction to ALL scenic modes
2. Add waypoint labeling instruction (JSON format: `{"lat": ..., "lng": ..., "label": "Park Name"}`)
3. Enhance nature mode with specific nature-seeking language for urban areas
4. Enhance explore mode with specific cultural/historic language
5. Add city-awareness instruction: "Consider the specific geography and notable places of {cityName}"

### parseWaypoints Enhancement
Extract `label` field from AI response JSON to populate `RouteWaypoint.label`.

### Street Dedup
Lower `DEDUP_THRESHOLD` from 0.15 to 0.10.

## Files to Modify
- `src/lib/route-ai.ts` - Enhanced prompts, label parsing
- `src/lib/street-dedup.ts` - Lower dedup threshold to 0.10
