/**
 * Total weight moved, per session, grouped by workout day.
 *
 * The question this answers is "is my Push A getting stronger", and the only
 * honest denominator for that is the previous Push A. Comparing one day to the
 * next calendar day measures which day of the split it was, not progress: a
 * leg day can be triple an arm day, so a raw day-to-day line is dominated by
 * the rotation and says almost nothing about getting stronger.
 *
 * So the series here are per workout DAY, each one its own history, compared
 * against the previous occurrence of that same day.
 *
 * Tonnage is weight x reps summed over the working sets of a session. Warm-ups
 * are excluded, matching `sessionSeries`: they are not what is progressing, and
 * counting them would mean logging one extra primer set reads as progress.
 */

export interface TonnageSet {
  workoutId: string;
  weight: number;
  reps: number;
  isWarmup?: boolean;
}

export interface TonnageWorkout {
  id: string;
  /** The day's name as stamped when the workout started. Null is ad-hoc. */
  dayName: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** One session's total, for a point on a day's trend. */
export interface TonnagePoint {
  workoutId: string;
  /** Epoch ms of the session, for a time-scaled axis. */
  t: number;
  /** ISO date of the session, local. */
  date: string;
  /** Weight x reps summed over the working sets, in the user's unit. */
  total: number;
  /** Working sets that contributed. Shown in the tooltip for context. */
  sets: number;
}

/** A whole workout day, with its history and how the last session compared. */
export interface DayTracker {
  /** The stamped day name, or null for the ad-hoc bucket. */
  dayName: string | null;
  /** The label to show. Ad-hoc sessions read as "Unplanned". */
  label: string;
  /** Oldest first, so a chart can draw it directly. */
  points: TonnagePoint[];
  /** The most recent session's total. */
  latest: number;
  /** The session before it, or null when there is only one. */
  previous: number | null;
  /**
   * Change from `previous` to `latest` as a fraction, or null when there is
   * nothing to compare against. 0.06 means six percent up.
   *
   * Null rather than 0 for a first session on purpose: "no change" and "no
   * comparison yet" are different things, and showing a first session as 0%
   * claims a comparison that does not exist.
   */
  change: number | null;
}

export const UNPLANNED_LABEL = "Unplanned";

/** Local ISO date, no time component. */
function localDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Weight x reps over the working sets of one session.
 *
 * A set with no load contributes nothing, which is correct for an empty row and
 * is also why a bodyweight-only movement logged at 0 does not register. That is
 * a known limitation rather than a bug: counting it would need the lifter's
 * bodyweight at that date, and silently inventing a number would make the trend
 * look like progress on a day nothing changed.
 */
export function sessionTonnage(sets: TonnageSet[]): { total: number; sets: number } {
  let total = 0;
  let counted = 0;

  for (const set of sets) {
    if (set.isWarmup) continue;
    if (set.reps < 1 || set.weight <= 0) continue;
    total += set.weight * set.reps;
    counted += 1;
  }

  // Rounded to one decimal: a 2.5 kg plate times an odd rep count produces a
  // long float, and nobody reads a tonnage to the microgram.
  return { total: Math.round(total * 10) / 10, sets: counted };
}

/**
 * Every workout day that has been trained, each with its own history.
 *
 * Only finished workouts count. A session in progress has an incomplete total
 * by definition, and letting it in would make the newest point on every trend
 * dip while you are still training.
 *
 * Days are ordered by their most recent session, newest first, so the day you
 * last trained leads — which on a rotating split is also the one you are most
 * likely to be looking for.
 */
export function dayTrackers(
  workouts: TonnageWorkout[],
  sets: TonnageSet[],
): DayTracker[] {
  const setsByWorkout = new Map<string, TonnageSet[]>();
  for (const set of sets) {
    const bucket = setsByWorkout.get(set.workoutId);
    if (bucket) bucket.push(set);
    else setsByWorkout.set(set.workoutId, [set]);
  }

  // Group by day name. The null bucket is kept separate rather than dropped:
  // an ad-hoc session is real training and should still be visible.
  const byDay = new Map<string | null, TonnagePoint[]>();

  for (const workout of workouts) {
    if (!workout.finishedAt) continue;

    const { total, sets: counted } = sessionTonnage(setsByWorkout.get(workout.id) ?? []);
    // A rest day is a finished workout with no sets. It is not a zero on a
    // volume trend, it is an absence, so it never becomes a point.
    if (counted === 0) continue;

    const point: TonnagePoint = {
      workoutId: workout.id,
      t: new Date(workout.startedAt).getTime(),
      date: localDate(workout.startedAt),
      total,
      sets: counted,
    };

    const bucket = byDay.get(workout.dayName);
    if (bucket) bucket.push(point);
    else byDay.set(workout.dayName, [point]);
  }

  const trackers: DayTracker[] = [];

  for (const [dayName, points] of byDay) {
    points.sort((a, b) => a.t - b.t);
    const latest = points[points.length - 1];
    const previous = points.length > 1 ? points[points.length - 2] : null;

    trackers.push({
      dayName,
      label: dayName ?? UNPLANNED_LABEL,
      points,
      latest: latest.total,
      previous: previous?.total ?? null,
      // Guard the divide: a previous session of 0 cannot happen here, since a
      // point needs at least one working set to exist, but a percentage change
      // against zero is undefined and worth refusing explicitly.
      change:
        previous && previous.total > 0 ? (latest.total - previous.total) / previous.total : null,
    });
  }

  // Newest-trained day first. Ties fall back to the label so the order is
  // stable rather than dependent on insertion.
  return trackers.sort((a, b) => {
    const diff = b.points[b.points.length - 1].t - a.points[a.points.length - 1].t;
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });
}

/**
 * Formats a tonnage for display.
 *
 * Tonnages run into five and six figures, where the digits stop being readable
 * as a quantity, so past ten thousand it reads as "12.9k". Below that the exact
 * figure fits and is more useful.
 */
export function formatTonnage(total: number): string {
  if (total >= 10_000) {
    const thousands = total / 1000;
    // One decimal up to 100k, none above it: "12.9k" is readable, "128.4k" is
    // just noise at that magnitude.
    return thousands >= 100
      ? `${Math.round(thousands)}k`
      : `${(Math.round(thousands * 10) / 10).toString()}k`;
  }
  return Math.round(total).toLocaleString("en-US");
}

/**
 * One formatter for a whole set of tonnages that will be read side by side.
 *
 * `formatTonnage` decides per value, which is right for a lone figure and
 * wrong for a grid: "8,420" next to "12.9k" makes two days that differ by half
 * look like they are in different units. Within a comparison set the scale has
 * to be shared, so the largest value decides the format for all of them.
 */
export function tonnageFormatter(values: number[]): (total: number) => string {
  const peak = values.length > 0 ? Math.max(...values) : 0;
  if (peak < 10_000) return (total) => Math.round(total).toLocaleString("en-US");

  return (total) => {
    const thousands = total / 1000;
    return peak >= 100_000
      ? `${Math.round(thousands)}k`
      : `${(Math.round(thousands * 10) / 10).toString()}k`;
  };
}

/**
 * A fitted axis with round tick values.
 *
 * Fitting the axis to the data is what lets a trend read at all — anchored to
 * zero, a real 24% climb gets squeezed into the top sliver of the plot and
 * looks flat. But fitting it naively produces ticks like "8,663" and "7,107",
 * which are noise: a reader uses axis labels as reference points, and a
 * reference point has to be a round number to be worth anything.
 *
 * So the range is snapped outward to a round step chosen from the 1 / 2 / 2.5 /
 * 5 series, the same ladder engineering scales have used for a century because
 * those are the intervals people divide and compare in their heads.
 */
export function niceAxis(
  values: number[],
  targetTicks = 4,
): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] };

  const low = Math.min(...values);
  const high = Math.max(...values);
  // A flat history has no span to divide, so fall back to the value itself and
  // let the padding below open a window around it.
  const span = high - low || Math.abs(high) || 1;

  const rawStep = span / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const niceStep =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10) *
    magnitude;

  // Half a step of breathing room at each end, then snapped out to the grid,
  // so no point ever sits on the frame of the plot.
  const min = Math.max(0, Math.floor((low - niceStep * 0.5) / niceStep) * niceStep);
  const max = Math.ceil((high + niceStep * 0.5) / niceStep) * niceStep;

  const count = Math.round((max - min) / niceStep);
  const ticks = Array.from({ length: count + 1 }, (_, i) =>
    // Rebuilt from the index rather than accumulated, so float error cannot
    // drift a tick to 7499.999999.
    Math.round((min + i * niceStep) * 1e6) / 1e6,
  );

  return { domain: [min, max], ticks };
}

/** The change as a signed percentage string, or null when there is none. */
export function formatChange(change: number | null): string | null {
  if (change === null) return null;
  const pct = Math.round(change * 100);
  if (pct === 0) return "level";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
