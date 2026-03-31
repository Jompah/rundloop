import type { GenerationLog, LatLng, ProviderName } from './types';
import { dbPut, dbGetAll } from '@/lib/db';

const LOGS_STORE = 'generation_logs';

export async function timeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const start = performance.now();
  const result = await fn();
  const elapsedMs = Math.round(performance.now() - start);
  return { result, elapsedMs };
}

export function createGenerationLog(params: {
  provider: ProviderName;
  providerOverrides: Record<string, string>;
  location: LatLng;
  distanceRequested: number;
  distanceActual: number;
  routingMs: number;
  geocodeMs: number;
  poiMs: number;
  totalMs: number;
  success: boolean;
  error?: string;
}): GenerationLog {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...params,
  };
}

export async function saveGenerationLog(log: GenerationLog): Promise<void> {
  try {
    await dbPut(LOGS_STORE, log);
  } catch {
    console.warn('[ProviderLogger] Failed to save generation log:', log.id);
  }
}

export async function getGenerationLogs(): Promise<GenerationLog[]> {
  try {
    return await dbGetAll<GenerationLog>(LOGS_STORE);
  } catch {
    return [];
  }
}

export async function exportGenerationLogs(): Promise<string> {
  const logs = await getGenerationLogs();
  return JSON.stringify(logs, null, 2);
}

export async function clearGenerationLogs(): Promise<void> {
  console.warn('[ProviderLogger] clearGenerationLogs not yet implemented with bulk delete');
}
