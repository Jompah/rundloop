// One-shot migration: promote historical free runs into reusable SavedRoutes.
import type { CompletedRun } from '@/types';
import { dbGetAll, dbPut } from './db';
import { promoteRunToRoute, updateRouteStats } from './route-library';
import { computeRunAnalysis, saveRunAnalysis } from './run-analysis';

export async function backfillFreeRunsToRoutes(): Promise<void> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (localStorage.getItem('drift_backfill_free_runs_v1')) return;

  try {
    const runs = await dbGetAll<CompletedRun>('runs');

    for (const run of runs) {
      if (run.routeId != null) continue;
      if (!run.trace || run.trace.length < 10) continue;
      if (run.distanceMeters < 500) continue;

      try {
        const saved = await promoteRunToRoute(run, 'Unknown');
        run.routeId = saved.id;
        run.routePolyline = saved.route.polyline;
        await dbPut('runs', run);

        const analysis = computeRunAnalysis(run);
        if (analysis) {
          await saveRunAnalysis(analysis);
          await updateRouteStats(saved.id, analysis);
        }
      } catch (err) {
        console.warn('[backfill] failed to promote run', run.id, err);
      }
    }

    localStorage.setItem('drift_backfill_free_runs_v1', 'true');
  } catch (err) {
    console.warn('[backfill] aborted', err);
  }
}
