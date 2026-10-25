/**
 * Estimated one-rep max, Epley formula.
 *
 *   e1RM = weight * (1 + reps / 30)
 *
 * Epley is only honest in the low rep ranges. Past about 12 reps the estimate
 * drifts high enough to be misleading, so this returns null there rather than
 * a number the user might trust. Null also covers the cases that are not a
 * working set at all: no reps, or no external load.
 */

export const E1RM_MAX_REPS = 12;

export function epley1RM(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (weight <= 0 || reps < 1) return null;
  if (reps > E1RM_MAX_REPS) return null;
  return weight * (1 + reps / 30);
}

/** Rounds an e1RM for display. Half-kilo precision; the estimate is not sharper. */
export function roundE1RM(value: number): number {
  return Math.round(value * 2) / 2;
}
