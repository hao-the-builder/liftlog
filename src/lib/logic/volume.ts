/**
 * Weekly training volume, counted in sets per muscle.
 *
 * A set counts 1 toward the exercise's primary muscle and 0.5 toward each
 * secondary. Fractional counting is the point: three sets of lat pulldown are
 * three sets for lats and one and a half for biceps, which is the only honest
 * way to compare a week of pulling against a week of direct arm work.
 *
 * Warm-ups do not count toward volume.
 */

export interface VolumeSet {
  exerciseId: string;
  completedAt: Date | string;
  isWarmup?: boolean;
}

export interface MuscleMap {
  primaryMuscle: string;
  secondaryMuscles: string[];
}

export const DIRECT_SET_VALUE = 1;
export const SECONDARY_SET_VALUE = 0.5;

/** The band the chart draws behind the bars. */
export const WEEKLY_TARGET_MIN = 10;
export const WEEKLY_TARGET_MAX = 20;

/**
 * Monday 00:00 local time for the week containing `date`.
 * Weeks start on Monday so a weekend session lands in the week it belongs to.
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0 is Sunday. Shift so Monday is 0 and Sunday is 6.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

/** Stable key for a week bucket, e.g. "2026-10-19". */
export function weekKey(date: Date): string {
  const start = startOfWeek(date);
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${start.getFullYear()}-${month}-${day}`;
}

/**
 * Sets per muscle for one collection of sets. Muscles with no work are absent
 * from the result rather than present with a zero.
 */
export function countSetsPerMuscle(
  sets: VolumeSet[],
  muscles: Map<string, MuscleMap>,
): Map<string, number> {
  const totals = new Map<string, number>();

  const add = (muscle: string, value: number) => {
    totals.set(muscle, (totals.get(muscle) ?? 0) + value);
  };

  for (const set of sets) {
    if (set.isWarmup) continue;
    const map = muscles.get(set.exerciseId);
    if (!map) continue;

    add(map.primaryMuscle, DIRECT_SET_VALUE);
    // A muscle listed twice, or listed as both primary and secondary, must not
    // be counted twice for the same set.
    const seen = new Set<string>([map.primaryMuscle]);
    for (const secondary of map.secondaryMuscles) {
      if (seen.has(secondary)) continue;
      seen.add(secondary);
      add(secondary, SECONDARY_SET_VALUE);
    }
  }

  return totals;
}

export interface WeekVolume {
  /** Monday of the week, local time. */
  weekStart: Date;
  key: string;
  perMuscle: Map<string, number>;
}

/** Buckets sets into weeks, most recent week first. */
export function weeklySetsPerMuscle(
  sets: VolumeSet[],
  muscles: Map<string, MuscleMap>,
): WeekVolume[] {
  const buckets = new Map<string, VolumeSet[]>();

  for (const set of sets) {
    const when = set.completedAt instanceof Date ? set.completedAt : new Date(set.completedAt);
    if (Number.isNaN(when.getTime())) continue;
    const key = weekKey(when);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(set);
    else buckets.set(key, [set]);
  }

  return [...buckets.entries()]
    .map(([key, bucketSets]) => ({
      key,
      weekStart: new Date(`${key}T00:00:00`),
      perMuscle: countSetsPerMuscle(bucketSets, muscles),
    }))
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

export interface MuscleComparison {
  muscle: string;
  thisWeek: number;
  lastWeek: number;
}

/**
 * This week against last week, for the bar chart. Every muscle that appears in
 * either week is present, so a muscle you trained last week but skipped this
 * week still shows with a zero rather than vanishing from the chart.
 */
export function compareWeeks(
  sets: VolumeSet[],
  muscles: Map<string, MuscleMap>,
  now: Date = new Date(),
): MuscleComparison[] {
  const thisKey = weekKey(now);
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastKey = weekKey(lastWeekDate);

  const weeks = weeklySetsPerMuscle(sets, muscles);
  const thisWeek = weeks.find((w) => w.key === thisKey)?.perMuscle ?? new Map<string, number>();
  const lastWeek = weeks.find((w) => w.key === lastKey)?.perMuscle ?? new Map<string, number>();

  const allMuscles = new Set<string>([...thisWeek.keys(), ...lastWeek.keys()]);

  return [...allMuscles]
    .map((muscle) => ({
      muscle,
      thisWeek: thisWeek.get(muscle) ?? 0,
      lastWeek: lastWeek.get(muscle) ?? 0,
    }))
    .sort((a, b) => b.thisWeek - a.thisWeek || a.muscle.localeCompare(b.muscle));
}
