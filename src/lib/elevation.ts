import type { TurnInstruction } from '@/types';

/**
 * Haversine distance between two [lng, lat] points in meters.
 * Inline copy following project pattern (see gps-filter.ts).
 */
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  // a, b are [lng, lat]
  const lat1 = a[1];
  const lng1 = a[0];
  const lat2 = b[1];
  const lng2 = b[0];
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLng = Math.sin(dLng / 2);
  const aVal =
    sinHalfDLat * sinHalfDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinHalfDLng * sinHalfDLng;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

/**
 * Fetch elevations from Open-Meteo Elevation API.
 * Coords are [lng, lat] (project convention). API expects lat, lng -- we swap.
 * Batches in groups of 100 (API limit).
 */
export async function fetchElevations(
  coords: [number, number][]
): Promise<number[]> {
  const elevations: number[] = [];
  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const lats = batch.map((c) => c[1]).join(',');
    const lngs = batch.map((c) => c[0]).join(',');
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
    );
    if (!res.ok) throw new Error(`Elevation API failed: ${res.status}`);
    const data = await res.json();
    elevations.push(...data.elevation);
  }
  return elevations;
}

/**
 * Compute grade (%) for each point in the route.
 * First point always has grade 0 (no previous point).
 * Grade = abs(elevDiff / horizontalDist) * 100.
 * Zero-distance segments return grade 0 (no division by zero).
 */
export function computeGrades(
  coords: [number, number][],
  elevations: number[]
): number[] {
  const grades: number[] = [0]; // first point has no grade
  for (let i = 1; i < coords.length; i++) {
    const dist = haversineMeters(coords[i - 1], coords[i]);
    if (dist === 0) {
      grades.push(0);
      continue;
    }
    const elevDiff = elevations[i] - elevations[i - 1];
    const grade = Math.abs(elevDiff / dist) * 100;
    grades.push(grade);
  }
  return grades;
}

/**
 * Map a grade percentage to a color.
 * <2% = green (flat), 2-4% = yellow (gentle), 4-8% = orange (moderate), >=8% = red (steep)
 */
export function gradeToColor(grade: number): string {
  if (grade < 2) return '#22c55e'; // green - flat
  if (grade < 4) return '#eab308'; // yellow - gentle
  if (grade < 8) return '#f97316'; // orange - moderate
  return '#ef4444'; // red - steep
}

/**
 * Build a MapLibre interpolate expression for line-gradient.
 * Maps each coordinate's grade to a color stop based on cumulative line-progress (0-1).
 * Deduplicates consecutive same-color stops for performance.
 */
export function buildGradientExpression(
  coords: [number, number][],
  grades: number[]
): unknown {
  // Compute cumulative distance for each point
  let totalDist = 0;
  const cumDist = [0];
  for (let i = 1; i < coords.length; i++) {
    totalDist += haversineMeters(coords[i - 1], coords[i]);
    cumDist.push(totalDist);
  }

  // Build color stops as [progress, color] pairs
  const stops: (number | string)[] = [];
  for (let i = 0; i < coords.length; i++) {
    const progress = totalDist > 0 ? cumDist[i] / totalDist : 0;
    const color = gradeToColor(grades[i]);
    stops.push(progress, color);
  }

  // Deduplicate consecutive same-color stops
  const deduped: (number | string)[] = [stops[0], stops[1]];
  for (let i = 2; i < stops.length; i += 2) {
    if (stops[i + 1] !== deduped[deduped.length - 1]) {
      deduped.push(stops[i], stops[i + 1]);
    }
  }

  return ['interpolate', ['linear'], ['line-progress'], ...deduped];
}

/**
 * Filter turn instructions for significant turns only.
 * Keeps turn-left, turn-right, u-turn. Filters out straight, arrive, depart.
 */
export function getSignificantTurns(
  instructions: TurnInstruction[]
): TurnInstruction[] {
  return instructions.filter(
    (inst) =>
      inst.type === 'turn-left' ||
      inst.type === 'turn-right' ||
      inst.type === 'u-turn'
  );
}
