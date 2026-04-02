import { getAnalysesNear } from './run-analysis';
import { getSavedRoutes, haversineMeters } from './storage';
import type { RunAnalysis, DeviationZone } from './run-analysis-types';

/**
 * Compare two [lat, lng] coords and return distance in meters.
 */
function coordDistanceM(a: [number, number], b: [number, number]): number {
  return haversineMeters(a[0], a[1], b[0], b[1]);
}

/**
 * Build a short natural-language feedback string from historical run data
 * near the given start position. Intended to be appended to AI route prompts.
 *
 * Returns an empty string when there is no relevant data.
 */
export async function buildPromptFeedback(
  startLat: number,
  startLng: number
): Promise<string> {
  const MAX_POINTS = 5;

  // 1. Get all RunAnalysis within 1 km of start
  const analyses = await getAnalysesNear(startLat, startLng, 1000);

  // 2. Collect all deviation zones across analyses, tagged with their analysis id
  type TaggedZone = { zone: DeviationZone; analysisId: string };
  const allZones: TaggedZone[] = [];
  for (const analysis of analyses) {
    for (const zone of analysis.deviationZones) {
      allZones.push({ zone, analysisId: analysis.id });
    }
  }

  // 3. Find systematic deviations: zones from ≥2 different analyses within 100 m
  const systematicCoords: [number, number][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < allZones.length; i++) {
    if (visited.has(i)) continue;
    const group: number[] = [i];
    for (let j = i + 1; j < allZones.length; j++) {
      if (visited.has(j)) continue;
      if (allZones[i].analysisId === allZones[j].analysisId) continue;
      const dist = coordDistanceM(
        allZones[i].zone.startCoord,
        allZones[j].zone.startCoord
      );
      if (dist <= 100) {
        group.push(j);
      }
    }
    if (group.length >= 2) {
      // Use the first zone's coord as the representative
      systematicCoords.push(allZones[i].zone.startCoord);
      group.forEach((idx) => visited.add(idx));
    }
  }

  // 4. Get verified routes within 1 km and extract preferred path endpoints
  const allRoutes = await getSavedRoutes();
  const nearbyVerified = allRoutes.filter((r) => {
    if (!r.verified) return false;
    const wps = r.route.waypoints;
    if (!wps || wps.length === 0) return false;
    const dist = haversineMeters(startLat, startLng, wps[0].lat, wps[0].lng);
    return dist <= 1000;
  });

  // 5. Build feedback lines, cap at 5
  const lines: string[] = [];

  for (const coord of systematicCoords) {
    if (lines.length >= MAX_POINTS) break;
    lines.push(
      `- Avoid area near ${coord[0].toFixed(4)}, ${coord[1].toFixed(4)} (runners consistently deviate here)`
    );
  }

  for (const route of nearbyVerified) {
    if (lines.length >= MAX_POINTS) break;
    const wps = route.route.waypoints;
    const first = wps[0];
    const last = wps[wps.length - 1];
    lines.push(
      `- Preferred path: ${first.lat.toFixed(4)},${first.lng.toFixed(4)} → ${last.lat.toFixed(4)},${last.lng.toFixed(4)} (high adherence verified route)`
    );
  }

  if (lines.length === 0) return '';

  return `HISTORICAL FEEDBACK (from real runs near this start):\n${lines.join('\n')}`;
}
