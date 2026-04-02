import type { DeviationZone, RunAnalysis } from './run-analysis-types';
import type { CompletedRun, FilteredPosition } from '@/types';

/** Haversine distance in meters between two [lat, lng] points */
function haversineMeters(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aVal =
    sinLat * sinLat +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

/**
 * Minimum distance in meters from a point to a line segment.
 * All coords are [lat, lng].
 */
export function pointToSegmentDistance(
  point: [number, number],
  segStart: [number, number],
  segEnd: [number, number]
): number {
  const dx = segEnd[1] - segStart[1];
  const dy = segEnd[0] - segStart[0];
  if (dx === 0 && dy === 0) {
    return haversineMeters(point, segStart);
  }
  let t =
    ((point[0] - segStart[0]) * dy + (point[1] - segStart[1]) * dx) /
    (dy * dy + dx * dx);
  t = Math.max(0, Math.min(1, t));
  const proj: [number, number] = [
    segStart[0] + t * dy,
    segStart[1] + t * dx,
  ];
  return haversineMeters(point, proj);
}

/**
 * Compute adherence (%) and deviation zones.
 * Downsamples trace if >200 points. Threshold: 50m from route.
 */
export function computeAdherence(
  trace: { lat: number; lng: number }[],
  polyline: [number, number][]
): { adherence: number; deviationZones: DeviationZone[] } {
  const THRESHOLD_M = 50;
  const MIN_ZONE_LENGTH_M = 100;

  // Downsample
  const step = trace.length > 200 ? 5 : 1;
  const sampled = trace.filter((_, i) => i % step === 0);

  let withinCount = 0;
  const distances: { point: [number, number]; dist: number }[] = [];

  for (const pt of sampled) {
    let minDist = Infinity;
    for (let i = 0; i < polyline.length - 1; i++) {
      const d = pointToSegmentDistance(
        [pt.lat, pt.lng],
        polyline[i],
        polyline[i + 1]
      );
      if (d < minDist) minDist = d;
    }
    distances.push({ point: [pt.lat, pt.lng], dist: minDist });
    if (minDist <= THRESHOLD_M) withinCount++;
  }

  const adherence = sampled.length > 0
    ? (withinCount / sampled.length) * 100
    : 0;

  // Find deviation zones: contiguous stretches >50m for >100m trace distance
  const deviationZones: DeviationZone[] = [];
  let zoneStart: number | null = null;
  let zoneMaxDev = 0;

  for (let i = 0; i < distances.length; i++) {
    if (distances[i].dist > THRESHOLD_M) {
      if (zoneStart === null) zoneStart = i;
      zoneMaxDev = Math.max(zoneMaxDev, distances[i].dist);
    } else if (zoneStart !== null) {
      // Zone ended — check length
      let zoneLength = 0;
      for (let j = zoneStart; j < i; j++) {
        zoneLength += haversineMeters(
          distances[j].point,
          distances[j + 1]?.point ?? distances[j].point
        );
      }
      if (zoneLength >= MIN_ZONE_LENGTH_M) {
        deviationZones.push({
          startCoord: distances[zoneStart].point,
          endCoord: distances[i - 1].point,
          maxDeviation: Math.round(zoneMaxDev),
          length: Math.round(zoneLength),
        });
      }
      zoneStart = null;
      zoneMaxDev = 0;
    }
  }

  // Handle zone that extends to end of trace
  if (zoneStart !== null) {
    let zoneLength = 0;
    for (let j = zoneStart; j < distances.length - 1; j++) {
      zoneLength += haversineMeters(
        distances[j].point,
        distances[j + 1].point
      );
    }
    if (zoneLength >= MIN_ZONE_LENGTH_M) {
      deviationZones.push({
        startCoord: distances[zoneStart].point,
        endCoord: distances[distances.length - 1].point,
        maxDeviation: Math.round(zoneMaxDev),
        length: Math.round(zoneLength),
      });
    }
  }

  return { adherence: Math.round(adherence * 10) / 10, deviationZones };
}

/**
 * Compute completion ratio (0–1).
 * trace distance / route distance, capped at 1.0.
 */
export function computeCompletion(
  trace: { lat: number; lng: number }[],
  routeDistance: number
): number {
  if (routeDistance <= 0 || trace.length < 2) return 0;
  let traceDist = 0;
  for (let i = 1; i < trace.length; i++) {
    traceDist += haversineMeters(
      [trace[i - 1].lat, trace[i - 1].lng],
      [trace[i].lat, trace[i].lng]
    );
  }
  return Math.min(1.0, traceDist / routeDistance);
}

/**
 * Compute full RunAnalysis for a completed run.
 * Returns null if run has no routePolyline.
 */
export function computeRunAnalysis(run: CompletedRun): RunAnalysis | null {
  if (!run.routePolyline || run.routePolyline.length < 2) return null;

  const { adherence, deviationZones } = computeAdherence(
    run.trace,
    run.routePolyline
  );
  const completion = computeCompletion(
    run.trace,
    run.distanceMeters
  );

  return {
    id: `ra-${run.id}-${Date.now()}`,
    runId: run.id,
    routeId: run.routeId ?? null,
    adherence,
    deviationZones,
    completion,
    computedAt: new Date().toISOString(),
  };
}

/** Persist a RunAnalysis to IndexedDB */
export async function saveRunAnalysis(analysis: RunAnalysis): Promise<void> {
  const { dbPut } = await import('./db');
  await dbPut('run_analysis', analysis);
}

/** Get all analyses for a specific route */
export async function getAnalysesForRoute(
  routeId: string
): Promise<RunAnalysis[]> {
  const { dbGetAll } = await import('./db');
  const all: RunAnalysis[] = await dbGetAll('run_analysis');
  return all.filter((a) => a.routeId === routeId);
}

/** Get all analyses near a point (scan + filter) */
export async function getAnalysesNear(
  lat: number,
  lng: number,
  radiusM: number
): Promise<RunAnalysis[]> {
  const { dbGetAll } = await import('./db');
  const all: RunAnalysis[] = await dbGetAll('run_analysis');
  return all.filter((a) => {
    if (a.deviationZones.length === 0) return false;
    // Use first deviation zone start as proxy for location
    // TODO: store start coord on RunAnalysis for better spatial queries
    return true; // For now return all — Task 4 refines this
  });
}
