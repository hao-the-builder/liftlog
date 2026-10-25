/**
 * Bodyweight smoothing and trend.
 *
 * Daily bodyweight is mostly noise: water, food, time of day. The number worth
 * showing is the trailing average, and the number worth acting on is how fast
 * that average is moving as a percentage of bodyweight per week.
 *
 * The series is allowed to have gaps. Every function here works off a trailing
 * window measured in days rather than in samples, so three weigh-ins in a week
 * and seven weigh-ins in a week both behave sensibly.
 */

export interface DatedValue {
  /** ISO date, "2026-10-25". */
  date: string;
  value: number;
}

export interface SmoothedPoint extends DatedValue {
  /** Trailing average over the window, always defined. */
  average: number;
  /** How many samples fell inside the window, including this one. */
  samples: number;
}

const DAY_MS = 86_400_000;

function toTime(date: string): number {
  // Parsed as local midnight so day arithmetic does not drift across zones.
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.getTime();
}

/** Sorts ascending by date and drops anything unusable. */
function clean(series: DatedValue[]): DatedValue[] {
  return series
    .filter((p) => Number.isFinite(p.value) && !Number.isNaN(toTime(p.date)))
    .slice()
    .sort((a, b) => toTime(a.date) - toTime(b.date));
}

/**
 * Trailing moving average over `windowDays` calendar days, inclusive of the
 * current point. With the default 7 and a daily series this is the familiar
 * seven-day average; with gaps it averages whatever actually falls in range.
 */
export function movingAverage(series: DatedValue[], windowDays = 7): SmoothedPoint[] {
  const points = clean(series);
  const out: SmoothedPoint[] = [];

  let start = 0;
  let sum = 0;

  for (let i = 0; i < points.length; i += 1) {
    sum += points[i].value;
    const cutoff = toTime(points[i].date) - (windowDays - 1) * DAY_MS;

    while (toTime(points[start].date) < cutoff) {
      sum -= points[start].value;
      start += 1;
    }

    const samples = i - start + 1;
    out.push({
      date: points[i].date,
      value: points[i].value,
      average: sum / samples,
      samples,
    });
  }

  return out;
}

export interface TrendResult {
  /** Change per week as a percentage of bodyweight. Negative means losing. */
  percentPerWeek: number;
  /** Absolute change per week, in the user's unit. */
  absolutePerWeek: number;
  /** Days actually spanned by the comparison. */
  spanDays: number;
}

/**
 * Weekly rate of change, read off the smoothed series rather than the raw one.
 *
 * Compares the latest smoothed value against the smoothed value closest to
 * `lookbackDays` earlier, then normalises to a per-week figure. Returns null
 * until there is enough spread to say anything: a single weigh-in, or two on
 * the same day, is not a trend.
 */
export function weeklyRateOfChange(
  series: DatedValue[],
  { windowDays = 7, lookbackDays = 14, minSpanDays = 4 } = {},
): TrendResult | null {
  const smoothed = movingAverage(series, windowDays);
  if (smoothed.length < 2) return null;

  const latest = smoothed[smoothed.length - 1];
  const latestTime = toTime(latest.date);
  const targetTime = latestTime - lookbackDays * DAY_MS;

  // The point nearest the target, preferring older over newer on a tie so the
  // span is as long as the data honestly supports.
  let reference = smoothed[0];
  let bestDistance = Infinity;
  for (const point of smoothed.slice(0, -1)) {
    const distance = Math.abs(toTime(point.date) - targetTime);
    if (distance < bestDistance) {
      bestDistance = distance;
      reference = point;
    }
  }

  const spanDays = (latestTime - toTime(reference.date)) / DAY_MS;
  if (spanDays < minSpanDays) return null;
  if (reference.average === 0) return null;

  const absolutePerWeek = ((latest.average - reference.average) / spanDays) * 7;
  const percentPerWeek = (absolutePerWeek / reference.average) * 100;

  return { percentPerWeek, absolutePerWeek, spanDays };
}
