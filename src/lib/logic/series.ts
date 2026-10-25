/**
 * Turning a pile of set logs into something a chart can draw.
 *
 * One point per session, not per set. A session is the unit a lifter thinks
 * in ("last Tuesday I hit 62.5 for 9"), and a point per set would make the
 * chart a scatter of warm-ups and back-off sets with no visible trend.
 */

import { epley1RM } from "./e1rm";

export interface SeriesSet {
  workoutId: string;
  weight: number;
  reps: number;
  isWarmup?: boolean;
  completedAt: string;
}

export interface SessionPoint {
  /** Epoch ms of the session, for a time-scaled axis. */
  t: number;
  /** ISO date of the session, local. */
  date: string;
  /** Heaviest working set of the session. */
  topWeight: number;
  /** Best Epley estimate of the session, null if every set was too high-rep. */
  e1rm: number | null;
  /** Reps achieved on the top set, for the tooltip. */
  topReps: number;
}

export type RangeKey = "4w" | "12w" | "6m" | "all";

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "4w", label: "4 wk", days: 28 },
  { key: "12w", label: "12 wk", days: 84 },
  { key: "6m", label: "6 mo", days: 182 },
  { key: "all", label: "All", days: null },
];

function localDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * One point per session, oldest first.
 *
 * Warm-ups are excluded: they are not what is progressing, and including them
 * would make the top-set line jump every time someone logs a 20 kg primer.
 */
export function sessionSeries(sets: SeriesSet[]): SessionPoint[] {
  const byWorkout = new Map<string, SeriesSet[]>();

  for (const set of sets) {
    if (set.isWarmup) continue;
    if (set.reps < 1 || set.weight <= 0) continue;
    const bucket = byWorkout.get(set.workoutId);
    if (bucket) bucket.push(set);
    else byWorkout.set(set.workoutId, [set]);
  }

  const points: SessionPoint[] = [];

  for (const sessionSets of byWorkout.values()) {
    let top = sessionSets[0];
    let best: number | null = null;
    let earliest = sessionSets[0].completedAt;

    for (const set of sessionSets) {
      if (set.weight > top.weight || (set.weight === top.weight && set.reps > top.reps)) {
        top = set;
      }
      const estimate = epley1RM(set.weight, set.reps);
      if (estimate !== null && (best === null || estimate > best)) best = estimate;
      if (set.completedAt < earliest) earliest = set.completedAt;
    }

    points.push({
      t: new Date(earliest).getTime(),
      date: localDate(earliest),
      topWeight: top.weight,
      topReps: top.reps,
      e1rm: best,
    });
  }

  return points.sort((a, b) => a.t - b.t);
}

/** Trims a series to a range, measured back from the most recent point. */
export function withinRange<T extends { t: number }>(
  points: T[],
  range: RangeKey,
  now: number = Date.now(),
): T[] {
  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  if (days === null) return points;
  const cutoff = now - days * 86_400_000;
  return points.filter((p) => p.t >= cutoff);
}
