'use client';

import { useState, useEffect } from 'react';
import type { CompletedRun, Run, AppSettings } from '@/types';
import { dbGetAllByIndex } from '@/lib/db';
import { getSettings } from '@/lib/storage';
import { computeRunStats, type RunStats } from '@/lib/run-stats';
import { formatPace, formatMetricDistance, formatElapsed } from '@/lib/metrics';
import { useTranslation } from '@/i18n';

interface StatsViewProps {
  onClose: () => void;
}

export default function StatsView({ onClose }: StatsViewProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<RunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<AppSettings['units']>('km');

  useEffect(() => {
    getSettings().then((s) => setUnits(s.units));
    dbGetAllByIndex<Run>('runs', 'startTime', 'prev')
      .then((all) => {
        const completed = all.filter((r): r is CompletedRun => 'endTime' in r);
        setStats(computeRunStats(completed));
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="absolute inset-0 bg-gray-950 z-30 flex items-center justify-center">
        <p className="text-gray-400">{t('history.loading')}</p>
      </div>
    );
  }

  if (!stats || stats.totalRuns === 0) {
    return (
      <div className="absolute inset-0 bg-gray-950 z-30 overflow-y-auto">
        <Header onClose={onClose} title={t('stats.title')} />
        <div className="flex flex-col items-center justify-center flex-1 px-6 pt-40">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600 mb-4">
            <path d="M3 3v18h18" />
            <path d="M7 16l4-8 4 4 5-9" />
          </svg>
          <p className="text-gray-400 text-center">{t('stats.noData')}</p>
        </div>
      </div>
    );
  }

  const maxWeeklyDist = Math.max(...stats.weeklyData.map((w) => w.distanceM), 1);
  const months = t('stats.months.short').split(',');

  return (
    <div className="absolute inset-0 bg-gray-950 z-30 overflow-y-auto" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom) + 1rem)' }}>
      <Header onClose={onClose} title={t('stats.title')} />

      <div className="px-4 space-y-5 pb-8">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label={t('stats.totalDistance')} value={formatMetricDistance(stats.totalDistanceM, units)} unit={units === 'km' ? 'km' : 'mi'} />
          <StatCard label={t('stats.totalRuns')} value={String(stats.totalRuns)} />
          <StatCard label={t('stats.avgPace')} value={formatPace(stats.averagePaceSecPerKm, units)} unit={units === 'km' ? '/km' : '/mi'} />
        </div>

        {/* This week highlight */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{t('stats.thisWeek')}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{formatMetricDistance(stats.thisWeekDistanceM, units)}</span>
            <span className="text-gray-400 text-sm">{units === 'km' ? 'km' : 'mi'}</span>
            <span className="text-gray-500 text-sm ml-auto">{stats.thisWeekRuns} {stats.thisWeekRuns === 1 ? 'run' : 'runs'}</span>
          </div>
          {stats.currentWeeklyStreak > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400">
                  <path d="M12 2c0 0-8 9-8 14a8 8 0 0016 0c0-5-8-14-8-14z" />
                </svg>
              </div>
              <span className="text-orange-400 text-sm font-medium">
                {t('stats.streak').replace('{count}', String(stats.currentWeeklyStreak))}
              </span>
              {stats.longestWeeklyStreak > stats.currentWeeklyStreak && (
                <span className="text-gray-500 text-xs ml-auto">
                  {t('stats.bestStreak').replace('{count}', String(stats.longestWeeklyStreak))}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Weekly bar chart */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">{t('stats.weeklyDistance')}</p>
          <div className="flex items-end gap-1 h-28">
            {stats.weeklyData.map((w, i) => {
              const height = maxWeeklyDist > 0 ? (w.distanceM / maxWeeklyDist) * 100 : 0;
              const isCurrentWeek = i === stats.weeklyData.length - 1;
              return (
                <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-sm min-h-[2px] ${isCurrentWeek ? 'bg-green-500' : w.distanceM > 0 ? 'bg-gray-600' : 'bg-gray-800'}`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-1">
            {stats.weeklyData.map((w, i) => {
              const d = new Date(w.weekStart);
              const label = i % 2 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '';
              return (
                <div key={w.weekStart} className="flex-1 text-center">
                  <span className="text-gray-600 text-[9px]">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pace trend */}
        {stats.monthlyPaceTrend.length >= 2 && (
          <div className="bg-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">{t('stats.paceTrend')}</p>
            <PaceTrendChart data={stats.monthlyPaceTrend} units={units} months={months} />
          </div>
        )}

        {/* Personal records */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">{t('stats.personalRecords')}</p>
          <div className="space-y-3">
            {stats.fastestPace && (
              <PRRow
                label={t('stats.fastestPace')}
                value={formatPace(stats.fastestPace.value, units)}
                unit={units === 'km' ? '/km' : '/mi'}
                date={stats.fastestPace.date}
              />
            )}
            {stats.longestRun && (
              <PRRow
                label={t('stats.longestRun')}
                value={formatMetricDistance(stats.longestRun.value, units)}
                unit={units === 'km' ? 'km' : 'mi'}
                date={stats.longestRun.date}
              />
            )}
            {stats.longestDuration && (
              <PRRow
                label={t('stats.totalTime')}
                value={formatElapsed(stats.longestDuration.value)}
                date={stats.longestDuration.date}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ onClose, title }: { onClose: () => void; title: string }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-800">
      <h1 className="text-xl font-bold text-white">{title}</h1>
      <button onClick={onClose} className="text-gray-400 p-2 active:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 text-center">
      <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-lg font-bold leading-tight">
        {value}
        {unit && <span className="text-gray-400 text-xs font-normal ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}

function PRRow({ label, value, unit, date }: { label: string; value: string; unit?: string; date: number }) {
  const dateStr = new Date(date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="text-right">
        <span className="text-white font-semibold">{value}</span>
        {unit && <span className="text-gray-400 text-xs ml-0.5">{unit}</span>}
        <span className="text-gray-600 text-xs ml-2">{dateStr}</span>
      </div>
    </div>
  );
}

function PaceTrendChart({ data, units, months }: { data: { month: string; avgPaceSecPerKm: number; runs: number }[]; units: 'km' | 'miles'; months: string[] }) {
  if (data.length < 2) return null;

  const paces = data.map((d) => d.avgPaceSecPerKm);
  const min = Math.min(...paces) - 10;
  const max = Math.max(...paces) + 10;
  const range = max - min || 1;

  const w = 280;
  const h = 80;
  const stepX = w / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: h - ((d.avgPaceSecPerKm - min) / range) * h,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div>
      <svg viewBox={`-10 -5 ${w + 20} ${h + 25}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {points.map((p, i) => (
          <g key={data[i].month}>
            <circle cx={p.x} cy={p.y} r="3" fill="#22c55e" />
            <text x={p.x} y={h + 16} textAnchor="middle" fill="#666" fontSize="9">
              {months[parseInt(data[i].month.split('-')[1]) - 1]}
            </text>
          </g>
        ))}
        <path d={pathD} fill="none" stroke="#22c55e" strokeWidth="2" />
        <text x={-8} y={5} textAnchor="end" fill="#666" fontSize="8">
          {formatPace(min + range, units)}
        </text>
        <text x={-8} y={h} textAnchor="end" fill="#666" fontSize="8">
          {formatPace(min, units)}
        </text>
      </svg>
    </div>
  );
}
