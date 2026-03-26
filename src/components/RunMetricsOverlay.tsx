'use client';

import type { FilteredPosition } from '@/types';
import {
  computeRollingPace,
  computeAveragePace,
  formatPace,
  formatMetricDistance,
  computeRemainingDistance,
  formatElapsed,
} from '@/lib/metrics';
import { useTranslation } from '@/i18n';

interface RunMetricsOverlayProps {
  trace: FilteredPosition[];
  elapsedMs: number;
  distanceMeters: number;
  routeDistanceMeters: number;
  runStatus: 'active' | 'paused';
  units: 'km' | 'miles';
  onPause: () => void;
  onResume: () => void;
  onEndRun: () => void;
  onVoiceToggle: () => void;
  voiceEnabled: boolean;
}

export default function RunMetricsOverlay({
  trace,
  elapsedMs,
  distanceMeters,
  routeDistanceMeters,
  runStatus,
  units,
  onPause,
  onResume,
  onEndRun,
  onVoiceToggle,
  voiceEnabled,
}: RunMetricsOverlayProps) {
  const { t } = useTranslation();
  const rollingPace = computeRollingPace(trace, 30_000);
  const avgPace = computeAveragePace(distanceMeters, elapsedMs);
  const remaining = computeRemainingDistance(routeDistanceMeters, distanceMeters);
  const progress = routeDistanceMeters > 0 ? Math.min((distanceMeters / routeDistanceMeters) * 100, 100) : 0;

  const isPaused = runStatus === 'paused';
  const unitLabel = units === 'miles' ? 'mi' : 'km';

  return (
    <div
      className={`absolute bottom-0 inset-x-0 bg-gray-900/90 backdrop-blur-sm rounded-t-2xl border-t border-gray-800 safe-bottom ${
        isPaused ? 'opacity-60 transition-opacity duration-300' : 'transition-opacity duration-300'
      }`}
    >
      {/* Paused overlay text */}
      {isPaused && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-white text-3xl font-bold animate-pulse">{t('nav.paused')}</span>
        </div>
      )}

      {/* Row 1 - Pace row */}
      <div className="px-6 pt-4 pb-2 flex">
        {/* Current rolling pace */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 uppercase tracking-wider font-normal">{t('metrics.pace')}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-green-400">{formatPace(rollingPace, units)}</span>
            <span className="text-base text-gray-400 font-normal">/{unitLabel}</span>
          </div>
        </div>
        {/* Average pace */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 uppercase tracking-wider font-normal">{t('metrics.avgPace')}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">{formatPace(avgPace, units)}</span>
            <span className="text-base text-gray-400 font-normal">/{unitLabel} avg</span>
          </div>
        </div>
      </div>

      {/* Row 2 - Distance and Time */}
      <div className="px-6 py-2 flex">
        {/* Distance */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 uppercase tracking-wider font-normal">{t('metrics.distance')}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">{formatMetricDistance(distanceMeters, units)}</span>
            <span className="text-base text-gray-400">{unitLabel}</span>
          </div>
        </div>
        {/* Time */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 uppercase tracking-wider font-normal">{t('metrics.time')}</div>
          <span className="text-3xl font-bold text-white">{formatElapsed(elapsedMs)}</span>
        </div>
      </div>

      {/* Row 3 - Remaining + progress bar */}
      <div className="px-6 py-2">
        <div className="text-xs text-gray-400 uppercase tracking-wider font-normal">{t('metrics.remaining')}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-green-400">{formatMetricDistance(remaining, units)}</span>
          <span className="text-base text-gray-400">{unitLabel}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Row 4 - Controls */}
      <div className="px-6 pt-2 pb-4 flex gap-2">
        {/* Voice toggle */}
        <button
          onClick={onVoiceToggle}
          className={`px-3 py-2 rounded-lg text-sm ${
            voiceEnabled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-800 text-gray-500'
          }`}
        >
          {voiceEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07'}
        </button>

        {/* Pause/Resume */}
        {runStatus === 'active' ? (
          <button
            onClick={onPause}
            className="bg-amber-500 text-white px-6 py-2 rounded-lg font-semibold active:bg-amber-600"
          >
            {t('nav.pause')}
          </button>
        ) : (
          <button
            onClick={onResume}
            className="bg-green-500 text-white px-6 py-2 rounded-lg font-semibold active:bg-green-600"
          >
            {t('nav.resume')}
          </button>
        )}

        {/* End */}
        <button
          onClick={onEndRun}
          className="bg-red-500/80 text-white px-4 py-2 rounded-lg font-semibold text-sm active:bg-red-600"
        >
          {t('nav.end')}
        </button>
      </div>
    </div>
  );
}
