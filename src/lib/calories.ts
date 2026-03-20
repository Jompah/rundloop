export function estimateCalories(distanceMeters: number, bodyWeightKg: number): number {
  const distanceKm = distanceMeters / 1000;
  return Math.round(distanceKm * bodyWeightKg * 1.036);
}
