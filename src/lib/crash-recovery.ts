import type { ActiveRunSnapshot, CompletedRun } from '../types';
import { dbPut, dbGetAll, dbDelete } from './db';

// --- Module state ---
let snapshotPointCount = 0;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Persist the current run state to IndexedDB.
 * Uses the same run ID so each write overwrites the previous snapshot
 * (no row accumulation).
 * Errors are logged but never thrown — snapshot failure must not crash the run.
 */
async function saveSnapshot(snapshot: ActiveRunSnapshot): Promise<void> {
  try {
    await dbPut('runs', snapshot);
  } catch (err) {
    console.error('Snapshot save failed:', err);
  }
}

/**
 * Start periodic snapshot schedule.
 * Saves the active run state to IndexedDB every 10 seconds.
 */
export function startSnapshotSchedule(getRunState: () => ActiveRunSnapshot): void {
  snapshotPointCount = 0;

  if (snapshotTimer) {
    clearInterval(snapshotTimer);
  }

  snapshotTimer = setInterval(() => {
    saveSnapshot(getRunState());
  }, 10_000);
}

/**
 * Stop the periodic snapshot schedule and reset point counter.
 */
export function stopSnapshotSchedule(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
  snapshotPointCount = 0;
}

/**
 * Called each time a GPS point is accepted by the filter.
 * After every 30 accepted points, triggers an immediate snapshot.
 */
export function onPointAccepted(getRunState: () => ActiveRunSnapshot): void {
  snapshotPointCount++;
  if (snapshotPointCount >= 30) {
    snapshotPointCount = 0;
    saveSnapshot(getRunState());
  }
}

/**
 * Scan IndexedDB for an incomplete run (has startTime but no endTime).
 * ActiveRunSnapshot lacks the `endTime` field; CompletedRun has it.
 * Returns the first incomplete run found, or null.
 */
export async function findIncompleteRun(): Promise<ActiveRunSnapshot | null> {
  const runs = await dbGetAll<ActiveRunSnapshot | CompletedRun>('runs');
  for (const run of runs) {
    if (!('endTime' in run)) {
      return run as ActiveRunSnapshot;
    }
  }
  return null;
}

/**
 * Remove an incomplete run record from IndexedDB (user chose "Discard").
 */
export async function clearIncompleteRun(id: string): Promise<void> {
  await dbDelete('runs', id);
}
