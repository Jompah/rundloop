'use client';

import { createClient } from './browser';
import type { SavedRoute } from '@/lib/storage';
import type { CompletedRun } from '@/types';
import type { RunAnalysis } from '@/lib/run-analysis-types';

async function getUser() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function syncRoute(route: SavedRoute): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    const supabase = createClient();
    await supabase.from('drift_routes').upsert({
      id: route.id,
      user_id: user.id,
      name: route.name ?? null,
      city: route.city,
      route: route.route,
      verified: route.verified ?? false,
      times_run: route.timesRun ?? 0,
      avg_adherence: route.avgAdherence ?? 0,
      last_run_at: route.lastRunAt ? new Date(route.lastRunAt).toISOString() : null,
      created_at: route.createdAt,
    });
  } catch (err) {
    console.warn('[sync] syncRoute failed', err);
  }
}

export async function syncRun(run: CompletedRun): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    const supabase = createClient();
    await supabase.from('drift_runs').upsert({
      id: run.id,
      user_id: user.id,
      route_id: run.routeId ?? null,
      start_time: new Date(run.startTime).toISOString(),
      end_time: new Date(run.endTime).toISOString(),
      elapsed_ms: run.elapsedMs,
      distance_meters: run.distanceMeters,
      trace: run.trace,
      route_polyline: run.routePolyline ?? null,
      analysis_id: run.analysisId ?? null,
      generation_log_id: run.generationLogId ?? null,
    });
  } catch (err) {
    console.warn('[sync] syncRun failed', err);
  }
}

export async function syncAnalysis(analysis: RunAnalysis): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    const supabase = createClient();
    await supabase.from('drift_run_analysis').upsert({
      id: analysis.id,
      user_id: user.id,
      run_id: analysis.runId,
      route_id: analysis.routeId ?? null,
      start_coord: analysis.startCoord ?? null,
      adherence: analysis.adherence,
      deviation_zones: analysis.deviationZones,
      completion: analysis.completion,
      computed_at: analysis.computedAt,
    });
  } catch (err) {
    console.warn('[sync] syncAnalysis failed', err);
  }
}

export async function deleteRouteFromSupabase(id: string): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    const supabase = createClient();
    await supabase.from('drift_routes').delete().eq('id', id);
  } catch (err) {
    console.warn('[sync] deleteRoute failed', err);
  }
}

export async function deleteRunFromSupabase(id: string): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    const supabase = createClient();
    await supabase.from('drift_runs').delete().eq('id', id);
  } catch (err) {
    console.warn('[sync] deleteRun failed', err);
  }
}

export async function syncAllToSupabase(): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    const { dbGetAll } = await import('@/lib/db');

    const [routes, runs, analyses] = await Promise.all([
      dbGetAll<SavedRoute>('routes'),
      dbGetAll<CompletedRun>('runs'),
      dbGetAll<RunAnalysis>('run_analysis'),
    ]);

    const supabase = createClient();

    if (routes.length > 0) {
      await supabase.from('drift_routes').upsert(
        routes.map((r) => ({
          id: r.id,
          user_id: user.id,
          name: r.name ?? null,
          city: r.city,
          route: r.route,
          verified: r.verified ?? false,
          times_run: r.timesRun ?? 0,
          avg_adherence: r.avgAdherence ?? 0,
          last_run_at: r.lastRunAt ? new Date(r.lastRunAt).toISOString() : null,
          created_at: r.createdAt,
        }))
      );
    }

    if (runs.length > 0) {
      await supabase.from('drift_runs').upsert(
        runs.map((r) => ({
          id: r.id,
          user_id: user.id,
          route_id: r.routeId ?? null,
          start_time: new Date(r.startTime).toISOString(),
          end_time: new Date(r.endTime).toISOString(),
          elapsed_ms: r.elapsedMs,
          distance_meters: r.distanceMeters,
          trace: r.trace,
          route_polyline: r.routePolyline ?? null,
          analysis_id: r.analysisId ?? null,
          generation_log_id: r.generationLogId ?? null,
        }))
      );
    }

    if (analyses.length > 0) {
      await supabase.from('drift_run_analysis').upsert(
        analyses.map((a) => ({
          id: a.id,
          user_id: user.id,
          run_id: a.runId,
          route_id: a.routeId ?? null,
          start_coord: a.startCoord ?? null,
          adherence: a.adherence,
          deviation_zones: a.deviationZones,
          completion: a.completion,
          computed_at: a.computedAt,
        }))
      );
    }

    console.log(`[sync] synced ${routes.length} routes, ${runs.length} runs, ${analyses.length} analyses`);
  } catch (err) {
    console.warn('[sync] syncAll failed', err);
  }
}

export async function pullFromSupabase(): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    const supabase = createClient();
    const { dbPut } = await import('@/lib/db');

    const [routesRes, runsRes, analysesRes] = await Promise.all([
      supabase.from('drift_routes').select('*').eq('user_id', user.id),
      supabase.from('drift_runs').select('*').eq('user_id', user.id),
      supabase.from('drift_run_analysis').select('*').eq('user_id', user.id),
    ]);

    for (const r of routesRes.data ?? []) {
      const route: SavedRoute = {
        id: r.id,
        name: r.name ?? undefined,
        route: r.route,
        city: r.city,
        createdAt: r.created_at,
        verified: r.verified ?? undefined,
        timesRun: r.times_run ?? undefined,
        avgAdherence: r.avg_adherence ?? undefined,
        lastRunAt: r.last_run_at ?? undefined,
      };
      await dbPut('routes', route);
    }

    for (const r of runsRes.data ?? []) {
      const run: CompletedRun = {
        id: r.id,
        startTime: new Date(r.start_time).getTime(),
        endTime: new Date(r.end_time).getTime(),
        elapsedMs: r.elapsed_ms,
        distanceMeters: r.distance_meters,
        trace: r.trace,
        routeId: r.route_id ?? null,
        routePolyline: r.route_polyline ?? undefined,
        generationLogId: r.generation_log_id ?? undefined,
        analysisId: r.analysis_id ?? undefined,
      };
      await dbPut('runs', run);
    }

    for (const a of analysesRes.data ?? []) {
      const analysis: RunAnalysis = {
        id: a.id,
        runId: a.run_id,
        routeId: a.route_id ?? null,
        startCoord: a.start_coord ?? undefined,
        adherence: a.adherence,
        deviationZones: a.deviation_zones,
        completion: a.completion,
        computedAt: a.computed_at,
      };
      await dbPut('run_analysis', analysis);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('drift:sync-complete'));
    }
    console.log(`[sync] pulled ${routesRes.data?.length ?? 0} routes, ${runsRes.data?.length ?? 0} runs, ${analysesRes.data?.length ?? 0} analyses`);
  } catch (err) {
    console.warn('[sync] pull failed', err);
  }
}
