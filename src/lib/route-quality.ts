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
  thresholdMeters: number = 30
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

export interface DeadEndDetour {
  streetName: string;
  distance: number; // meters
}

/**
 * Names that appear in Google Routes instructions but are NOT actual street names.
 * These are routing hints/artifacts (tolls, stairs, generic references) that
 * should not be treated as street identifiers when detecting detours.
 */
const IGNORE_STREET_NAMES = new Set([
  'the path', 'vägtullar', 'vägtull', 'ta trappan', 'trappan',
  'the bridge', 'bron', 'the tunnel', 'tunneln', 'stairs',
  // Google Maps routing artifacts that aren't street names
  'sväng lätt höger', 'sväng lätt vänster',
  'sväng höger', 'sväng vänster',
  'fortsätt rakt fram', 'continue straight',
  'ta avfarten', 'take the exit',
  'slight right', 'slight left',
  'turn right', 'turn left',
]);

/**
 * Prefixes that indicate the extracted text is a routing hint/artifact rather
 * than a street name (e.g. "destinationen kommer att vara på vänster sida"
 * from a "Kör vidare along X, destinationen kommer..." instruction).
 */
const IGNORE_NAME_PREFIXES = [
  'destinationen kommer',
  'destinationen finns',
  'destination will',
];

/** True if the extracted name is actually a routing artifact/hint. */
function isRoutingArtifact(name: string): boolean {
  if (IGNORE_STREET_NAMES.has(name)) return true;
  for (const prefix of IGNORE_NAME_PREFIXES) {
    if (name.startsWith(prefix)) return true;
  }
  return false;
}

/** True if the name has at least one alphabetic char (a-z / å ä ö). */
function hasLetter(name: string): boolean {
  return /[a-zåäö]/i.test(name);
}

/**
 * Detect dead-end detour patterns in route instructions.
 * These are short side-trips where OSRM routes onto a street and quickly exits
 * the same way, adding distance without meaningful progress.
 *
 * Detection patterns:
 * 1. A street name appears exactly once in the full route (visited as a dead-end side trip)
 * 2. An instruction goes onto a street and within 2 instructions exits the same way
 * 3. Two consecutive turns are within 80m of each other (sharp in-and-out)
 */
export function detectDeadEndDetours(instructions: TurnInstruction[]): DeadEndDetour[] {
  const detours: DeadEndDetour[] = [];
  const seenStreets = new Set<string>();

  // Extract street names from all instructions
  const streetEntries: { name: string; index: number; distance: number; location: [number, number] }[] = [];
  for (let i = 0; i < instructions.length; i++) {
    const inst = instructions[i];
    const match = inst.text.match(/(?:onto|on|along)\s+(.+?)(?:\s*$)/i);
    if (match) {
      const name = match[1].trim().toLowerCase();
      if (isRoutingArtifact(name)) continue; // Skip routing hints/artifacts
      if (!hasLetter(name)) continue; // Require at least one letter — skip numeric/punct-only
      streetEntries.push({ name, index: i, distance: inst.distance, location: inst.location });
    }
  }

  // Pattern 1: Street name appears exactly once (dead-end side trip)
  const streetCounts = new Map<string, number>();
  for (const entry of streetEntries) {
    streetCounts.set(entry.name, (streetCounts.get(entry.name) || 0) + 1);
  }
  for (const entry of streetEntries) {
    // Skip synthetic unnamed-segment keys and ignored routing-hint names
    if (entry.name.startsWith('_unnamed_')) continue;
    if (isRoutingArtifact(entry.name)) continue;
    if (streetCounts.get(entry.name) === 1 && entry.distance < 200) {
      if (!seenStreets.has(entry.name)) {
        detours.push({ streetName: entry.name, distance: entry.distance });
        seenStreets.add(entry.name);
      }
    }
  }

  // Pattern 2: Enter and exit same street within 2 instructions
  for (let i = 0; i < streetEntries.length - 2; i++) {
    const enter = streetEntries[i];
    // Check if within 2 instructions ahead the route goes back the same direction
    for (let j = i + 1; j <= Math.min(i + 2, streetEntries.length - 1); j++) {
      const exit = streetEntries[j];
      if (enter.name === exit.name && !seenStreets.has(enter.name)) {
        detours.push({ streetName: enter.name, distance: enter.distance + exit.distance });
        seenStreets.add(enter.name);
        break;
      }
    }
  }

  // Pattern 3: Two consecutive turns within 80m of each other (sharp in-and-out)
  for (let i = 0; i < instructions.length - 1; i++) {
    const inst = instructions[i];
    const next = instructions[i + 1];
    if (inst.type === 'arrive' || inst.type === 'depart' || next.type === 'arrive' || next.type === 'depart') continue;

    const dist = haversineMeters(
      inst.location[1], inst.location[0],
      next.location[1], next.location[0]
    );
    const match = inst.text.match(/(?:onto|on|along)\s+(.+?)(?:\s*$)/i);
    const rawName = match ? match[1].trim().toLowerCase() : null;
    const hasRealName =
      rawName !== null && hasLetter(rawName) && !isRoutingArtifact(rawName);

    // Named segments: original threshold. Unnamed: require BOTH steps to be short
    // (deterministic location-based key so repeated unnamed segments dedupe).
    const named = hasRealName && dist < 80 && inst.distance < 150;
    const unnamed =
      !hasRealName && dist < 80 && inst.distance < 150 && next.distance < 150;

    if (named || unnamed) {
      const streetName = hasRealName
        ? rawName!
        : `_unnamed_${Math.round(inst.location[0] * 1000)}_${Math.round(inst.location[1] * 1000)}`;
      if (!seenStreets.has(streetName)) {
        detours.push({ streetName, distance: inst.distance });
        seenStreets.add(streetName);
      }
    }
  }

  return detours;
}

/**
 * Assess the overall quality of a generated route.
 * Returns a score from 0 (terrible) to 100 (perfect).
 *
 * Factors:
 * - Short segment ratio: many short segments = side-street detours
 * - Backtracking: same street used twice in different parts
 * - Detour ratio: actual distance vs straight-line efficiency
 * - Dead-end detours: side trips onto dead-end streets
 */
export function assessRouteQuality(route: GeneratedRoute): number {
  let score = 100;

  const totalSegments = Math.max(route.polyline.length - 1, 1);

  // --- Factor 1: Short segments (under 30m) ---
  const shortCount = countShortSegments(route.polyline, 30);
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

  // --- Factor 4: Dead-end detours ---
  const deadEndDetours = detectDeadEndDetours(route.instructions);
  score -= deadEndDetours.length * 20;

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
  const shortCount = countShortSegments(polyline, 30);
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
