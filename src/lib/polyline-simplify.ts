// Iterative Douglas-Peucker simplification for [lng, lat] polylines, tolerance in meters.

export function simplifyPolyline(
  points: Array<[number, number]>,
  epsilonMeters: number = 5
): Array<[number, number]> {
  if (points.length <= 2) return points.slice();
  if (epsilonMeters <= 0) return points.slice();

  const n = points.length;
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;

  const stack: Array<[number, number]> = [];
  stack.push([0, n - 1]);

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end <= start + 1) continue;

    let maxDist = -1;
    let maxIndex = -1;

    const [aLng, aLat] = points[start];
    const [bLng, bLat] = points[end];

    for (let i = start + 1; i < end; i++) {
      const [pLng, pLat] = points[i];
      const d = perpendicularDistanceMeters(pLat, pLng, aLat, aLng, bLat, bLng);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }

    if (maxDist > epsilonMeters && maxIndex !== -1) {
      keep[maxIndex] = true;
      stack.push([start, maxIndex]);
      stack.push([maxIndex, end]);
    }
  }

  const result: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

function perpendicularDistanceMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const refLat = (aLat + bLat) / 2;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((refLat * Math.PI) / 180);

  const ax = 0;
  const ay = 0;
  const bx = (bLng - aLng) * mPerDegLng;
  const by = (bLat - aLat) * mPerDegLat;
  const px = (pLng - aLng) * mPerDegLng;
  const py = (pLat - aLat) * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}
