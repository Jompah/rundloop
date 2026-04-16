import type { CompletedRun } from '@/types';
import { computeAveragePace } from './metrics';

export interface WeeklyBucket {
  weekStart: string;
  distanceM: number;
  timeMs: number;
  runs: number;
  avgPaceSecPerKm: number;
}

export interface MonthlyPace {
  month: string;
  avgPaceSecPerKm: number;
  runs: number;
}

export interface PersonalRecord {
  value: number;
  runId: string;
  date: number;
}

export interface RunStats {
  totalRuns: number;
  totalDistanceM: number;
  totalTimeMs: number;
  averagePaceSecPerKm: number | null;
  longestRun: PersonalRecord | null;
  fastestPace: PersonalRecord | null;
  longestDuration: PersonalRecord | null;
  currentWeeklyStreak: number;
  longestWeeklyStreak: number;
  weeklyData: WeeklyBucket[];
  monthlyPaceTrend: MonthlyPace[];
  thisWeekDistanceM: number;
  thisWeekRuns: number;
}

function getISOWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function groupByWeek(runs: CompletedRun[]): Map<string, CompletedRun[]> {
  const map = new Map<string, CompletedRun[]>();
  for (const run of runs) {
    const key = getISOWeekStart(new Date(run.startTime));
    const arr = map.get(key) ?? [];
    arr.push(run);
    map.set(key, arr);
  }
  return map;
}

function groupByMonth(runs: CompletedRun[]): Map<string, CompletedRun[]> {
  const map = new Map<string, CompletedRun[]>();
  for (const run of runs) {
    const key = getMonthKey(new Date(run.startTime));
    const arr = map.get(key) ?? [];
    arr.push(run);
    map.set(key, arr);
  }
  return map;
}

function computeStreaks(weeklyMap: Map<string, CompletedRun[]>): { current: number; longest: number } {
  if (weeklyMap.size === 0) return { current: 0, longest: 0 };

  const now = new Date();
  const currentWeek = getISOWeekStart(now);
  const lastWeek = getISOWeekStart(new Date(now.getTime() - 7 * 86400000));

  const weeks = Array.from(weeklyMap.keys()).sort().reverse();

  let current = 0;
  let longest = 0;
  let streak = 0;
  let expectedWeek: string = weeks[0] === currentWeek || weeks[0] === lastWeek ? weeks[0] : '';

  if (!expectedWeek) return { current: 0, longest: Math.max(...computeAllStreaks(weeks)) };

  for (const week of weeks) {
    if (week === expectedWeek) {
      streak++;
      const prevWeek = new Date(expectedWeek);
      prevWeek.setDate(prevWeek.getDate() - 7);
      expectedWeek = prevWeek.toISOString().slice(0, 10);
    } else {
      if (current === 0) current = streak;
      longest = Math.max(longest, streak);
      streak = 1;
      const prevWeek = new Date(week);
      prevWeek.setDate(prevWeek.getDate() - 7);
      expectedWeek = prevWeek.toISOString().slice(0, 10);
    }
  }
  if (current === 0) current = streak;
  longest = Math.max(longest, streak);

  return { current, longest };
}

function computeAllStreaks(sortedWeeksDesc: string[]): number[] {
  const streaks: number[] = [];
  let streak = 1;
  for (let i = 1; i < sortedWeeksDesc.length; i++) {
    const prev = new Date(sortedWeeksDesc[i - 1]);
    const curr = new Date(sortedWeeksDesc[i]);
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (Math.abs(diffDays - 7) < 2) {
      streak++;
    } else {
      streaks.push(streak);
      streak = 1;
    }
  }
  streaks.push(streak);
  return streaks;
}

export function computeRunStats(runs: CompletedRun[]): RunStats {
  const validRuns = runs.filter((r) => r.distanceMeters > 100 && r.elapsedMs > 10000);
  const sorted = [...validRuns].sort((a, b) => a.startTime - b.startTime);

  const totalDistanceM = sorted.reduce((s, r) => s + r.distanceMeters, 0);
  const totalTimeMs = sorted.reduce((s, r) => s + r.elapsedMs, 0);
  const averagePaceSecPerKm = computeAveragePace(totalDistanceM, totalTimeMs);

  let longestRun: PersonalRecord | null = null;
  let fastestPace: PersonalRecord | null = null;
  let longestDuration: PersonalRecord | null = null;

  for (const run of sorted) {
    if (!longestRun || run.distanceMeters > longestRun.value) {
      longestRun = { value: run.distanceMeters, runId: run.id, date: run.startTime };
    }
    if (!longestDuration || run.elapsedMs > longestDuration.value) {
      longestDuration = { value: run.elapsedMs, runId: run.id, date: run.startTime };
    }
    const pace = computeAveragePace(run.distanceMeters, run.elapsedMs);
    if (pace && (!fastestPace || pace < fastestPace.value)) {
      fastestPace = { value: pace, runId: run.id, date: run.startTime };
    }
  }

  const weeklyMap = groupByWeek(sorted);
  const { current: currentWeeklyStreak, longest: longestWeeklyStreak } = computeStreaks(weeklyMap);

  const now = new Date();
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 86400000);
  const weeklyData: WeeklyBucket[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveWeeksAgo.getTime() + i * 7 * 86400000);
    const weekStart = getISOWeekStart(d);
    const weekRuns = weeklyMap.get(weekStart) ?? [];
    const dist = weekRuns.reduce((s, r) => s + r.distanceMeters, 0);
    const time = weekRuns.reduce((s, r) => s + r.elapsedMs, 0);
    weeklyData.push({
      weekStart,
      distanceM: dist,
      timeMs: time,
      runs: weekRuns.length,
      avgPaceSecPerKm: computeAveragePace(dist, time) ?? 0,
    });
  }

  const monthlyMap = groupByMonth(sorted);
  const monthlyPaceTrend: MonthlyPace[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(d);
    const monthRuns = monthlyMap.get(key) ?? [];
    const dist = monthRuns.reduce((s, r) => s + r.distanceMeters, 0);
    const time = monthRuns.reduce((s, r) => s + r.elapsedMs, 0);
    const pace = computeAveragePace(dist, time);
    if (monthRuns.length > 0 && pace) {
      monthlyPaceTrend.push({ month: key, avgPaceSecPerKm: pace, runs: monthRuns.length });
    }
  }

  const currentWeekStart = getISOWeekStart(now);
  const thisWeekRuns = weeklyMap.get(currentWeekStart) ?? [];

  return {
    totalRuns: sorted.length,
    totalDistanceM,
    totalTimeMs,
    averagePaceSecPerKm,
    longestRun,
    fastestPace,
    longestDuration,
    currentWeeklyStreak,
    longestWeeklyStreak,
    weeklyData,
    monthlyPaceTrend,
    thisWeekDistanceM: thisWeekRuns.reduce((s, r) => s + r.distanceMeters, 0),
    thisWeekRuns: thisWeekRuns.length,
  };
}
