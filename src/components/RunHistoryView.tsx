'use client';

import { useState, useEffect } from 'react';
import type { CompletedRun, Run } from '@/types';
import { dbGetAllByIndex } from '@/lib/db';
import { RouteThumbnail } from './RouteThumbnail';
import {
  formatMetricDistance,
  formatElapsed,
  formatPace,
  computeAveragePace,
} from '@/lib/metrics';

interface RunHistoryViewProps {
  onSelectRun: (run: CompletedRun) => void;
  refreshKey?: number;
}

export function RunHistoryView({ onSelectRun, refreshKey }: RunHistoryViewProps) {
  const [runs, setRuns] = useState<CompletedRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dbGetAllByIndex<Run>('runs', 'startTime', 'prev')
      .then((all) => {
        const completed = all.filter(
          (r): r is CompletedRun => 'endTime' in r
        );
        setRuns(completed);
      })
      .catch(() => {
        setRuns([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshKey]);

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-16">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-white">History</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-gray-400">Loading...</p>
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-600"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-400 mt-4">
            No runs yet
          </h2>
          <p className="text-sm text-gray-500 mt-2 text-center max-w-xs">
            Complete your first run to see it here
          </p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div>
          {runs.map((run) => {
            const avgPace = computeAveragePace(run.distanceMeters, run.elapsedMs);
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectRun(run)}
                className="mx-4 mb-3 bg-gray-800 rounded-2xl p-4 flex items-center gap-4 active:bg-gray-700 cursor-pointer w-[calc(100%-2rem)] text-left min-h-[44px]"
              >
                <RouteThumbnail points={run.trace} size={80} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-400">
                    {new Date(run.startTime).toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xl font-bold text-white">
                    {formatMetricDistance(run.distanceMeters, 'km')} km
                  </p>
                  <p className="text-sm text-gray-400">
                    {formatElapsed(run.elapsedMs)} &middot; {formatPace(avgPace, 'km')} /km
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
