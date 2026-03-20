import type { FilteredPosition } from '@/types';
import { haversineMeters } from './storage';

/**
 * Compute rolling pace from the most recent GPS trace window.
 * Returns seconds per kilometer, or null if insufficient data.
 */
export function computeRollingPace(
  trace: FilteredPosition[],
  windowMs = 30_000
): number | null {
  if (trace.length < 2) return null;

  const latestTime = trace[trace.length - 1].timestamp;
  const windowStart = latestTime - windowMs;

  // Find the first index within the window
  let startIdx = trace.length - 1;
  for (let i = trace.length - 1; i >= 0; i--) {
    if (trace[i].timestamp >= windowStart) {
      startIdx = i;
    } else {
      break;
    }
  }

  const windowPoints = trace.slice(startIdx);
  if (windowPoints.length < 2) return null;

  // Sum haversine distances within window
  let distMeters = 0;
  for (let i = 1; i < windowPoints.length; i++) {
    distMeters += haversineMeters(
      windowPoints[i - 1].lat,
      windowPoints[i - 1].lng,
      windowPoints[i].lat,
      windowPoints[i].lng
    );
  }

  if (distMeters < 1) return null;

  const elapsedSec =
    (windowPoints[windowPoints.length - 1].timestamp - windowPoints[0].timestamp) / 1000;

  if (elapsedSec <= 0) return null;

  return (elapsedSec / distMeters) * 1000;
}

/**
 * Compute average pace from total distance and elapsed time.
 * Returns seconds per kilometer, or null if insufficient data.
 */
export function computeAveragePace(
  distanceMeters: number,
  elapsedMs: number
): number | null {
  if (distanceMeters < 10) return null;
  if (elapsedMs < 1000) return null;

  return (elapsedMs / 1000 / distanceMeters) * 1000;
}

/**
 * Format a pace value (seconds per km) as "M:SS" string.
 * Converts to per-mile if units === 'miles'.
 */
export function formatPace(
  paceSecsPerKm: number | null,
  units: 'km' | 'miles'
): string {
  if (paceSecsPerKm === null) return '--:--';

  let pace = paceSecsPerKm;
  if (units === 'miles') {
    pace = pace * 1.60934;
  }

  const minutes = Math.floor(pace / 60);
  const seconds = Math.round(pace % 60);

  // Handle edge case where rounding seconds to 60
  if (seconds === 60) {
    return `${minutes + 1}:00`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Convert meters to km or miles with 1 decimal place.
 */
export function formatMetricDistance(
  meters: number,
  units: 'km' | 'miles'
): string {
  if (units === 'miles') {
    return (meters / 1609.34).toFixed(1);
  }
  return (meters / 1000).toFixed(1);
}

/**
 * Compute remaining distance, clamped to zero.
 */
export function computeRemainingDistance(
  routeDistanceMeters: number,
  coveredDistanceMeters: number
): number {
  return Math.max(0, routeDistanceMeters - coveredDistanceMeters);
}

/**
 * Format elapsed milliseconds as MM:SS or H:MM:SS.
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
