import { GeneratedRoute, TurnInstruction } from '@/types';

/**
 * Count segments in the route polyline that are shorter than a given threshold.
 * Short segments often indicate unnecessary side-street detours where OSRM
 * routes into residential dead-ends to hit exact distance targets.
 *
 * @param polyline - Array of [lng, lat] coordinate pairs
 * @param thresholdMeters - Segments shorter than this are counted (default 50m)
 * @returns Number of segments under the threshold
 */
export function countShortSegments(
  polyline: [number, number][],
  thresholdMeters: number = 50
): number {
  if (polyline.length < 2) return 0;

  let count = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [lng1, lat1] = polyline[i];
    const [lng2, lat2] = polyline[i + 1];
    const dist = haversineMeters(lat1, lng1, lat2, lng2);
    if (dist < thresholdMeters) {
      count++;
    }
  }
  return count;
}

/**
 * Detect backtracking: same street name used in different (non-consecutive)
 * parts of the route, suggesting an out-and-back detour.
 */
function detectBacktracking(instructions: TurnInstruction[]): string[] {
  const streetNames: string[] = [];
  for (const inst of instructions) {
    const match = inst.text.match(/(?:onto|on|along)\s+(.+?)(?:\s*$)/i);
    if (match) {
      streetNames.push(match[1].trim().toLowerCase());
    }
  }

  // Collapse consecutive same-street segments
  const collapsed: string[] = [];
  for (const name of streetNames) {
    if (name === 'the path') continue; // Skip unnamed segments
    if (collapsed.length === 0 || collapsed[collapsed.length - 1] !== name) {
      collapsed.push(name);
    }
  }

  // Find non-consecutive duplicates (= backtracking)
  const seen = new Set<string>();
  const backtracked: string[] = [];
  for (const name of collapsed) {
    if (seen.has(name)) {
      if (!backtracked.includes(name)) {
        backtracked.push(name);
      }
    } else {
      seen.add(name);
    }
  }

  return backtracked;
}

/**
 * Assess the overall quality of a generated route.
 * Returns a score from 0 (terrible) to 100 (perfect).
 *
 * Factors:
 * - Short segment ratio: many short segments = side-street detours
 * - Backtracking: same street used twice in different parts
 * - Detour ratio: actual distance vs straight-line efficiency
 */
export function assessRouteQuality(route: GeneratedRoute): number {
  let score = 100;

  const totalSegments = Math.max(route.polyline.length - 1, 1);

  // --- Factor 1: Short segments (under 50m) ---
  const shortCount = countShortSegments(route.polyline, 50);
  const shortRatio = shortCount / totalSegments;
  // Penalize: more than 10% short segments is bad, more than 25% is terrible
  if (shortRatio > 0.25) {
    score -= 35;
  } else if (shortRatio > 0.20) {
    score -= 25;
  } else if (shortRatio > 0.10) {
    score -= 15;
  }

  // --- Factor 2: Backtracking ---
  const backtrackedStreets = detectBacktracking(route.instructions);
  // Each backtracked street costs points
  score -= backtrackedStreets.length * 8;

  // --- Factor 3: Very short instruction segments (OSRM step level) ---
  // Count instruction steps under 30m -- these are almost always detour artifacts
  const tinySteps = route.instructions.filter(
    (inst) => inst.distance < 30 && inst.type !== 'arrive' && inst.type !== 'depart'
  ).length;
  score -= tinySteps * 3;

  return Math.max(0, Math.min(100, score));
}

/**
 * Check if a route has too many short segments, indicating detour-heavy geometry.
 * Used in binary search to prefer smoother alternatives.
 *
 * @param polyline - Route polyline from OSRM
 * @param thresholdRatio - Max acceptable ratio of short segments (default 0.20 = 20%)
 * @returns true if the route has excessive short segments
 */
export function hasExcessiveShortSegments(
  polyline: [number, number][],
  thresholdRatio: number = 0.20
): boolean {
  const totalSegments = Math.max(polyline.length - 1, 1);
  const shortCount = countShortSegments(polyline, 50);
  return (shortCount / totalSegments) > thresholdRatio;
}

// Local haversine to avoid circular dependency with storage.ts
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
