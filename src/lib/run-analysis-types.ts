export interface DeviationZone {
  startCoord: [number, number];
  endCoord: [number, number];
  maxDeviation: number;
  length: number;
}

export interface RunAnalysis {
  id: string;
  runId: string;
  routeId: string | null;
  startCoord?: [number, number];
  adherence: number;
  deviationZones: DeviationZone[];
  completion: number;
  computedAt: string;
}
