/**
 * Double progression.
 *
 * The rule the app follows, stated once:
 *
 *   Work inside a rep range at a fixed load. When every working set reaches
 *   the top of the range, add the smallest weight step you have. Until then,
 *   keep the load and beat last session by one rep on at least one set.
 *
 * The weight step is never guessed from the muscle group. It comes from the
 * user: a per-exercise override if they set one, otherwise their profile
 * default. Gyms differ, and a 2.5 kg jump the user cannot actually load is
 * worse than no suggestion at all.
 */

export interface WorkingSet {
  weight: number;
  reps: number;
  isWarmup?: boolean;
}

export type ProgressionHint =
  | {
      kind: "first-time";
      text: string;
    }
  | {
      kind: "add-weight";
      /** The load to work at next session. */
      targetWeight: number;
      previousWeight: number;
      increment: number;
      text: string;
    }
  | {
      kind: "add-rep";
      /** Keep this load. */
      targetWeight: number;
      /** The set that fell short, 1-based, as the user counts them. */
      setNumber: number;
      /** Reps to beat on that set. */
      targetReps: number;
      text: string;
    };

export interface ProgressionInput {
  /** Last session's sets for this exercise, in the order they were performed. */
  lastSession: WorkingSet[];
  repMin: number;
  repMax: number;
  /** The user's weight step for this exercise. Must be positive. */
  increment: number;
  unit?: "kg" | "lb";
}

function formatWeight(value: number, unit: string): string {
  // Round to two places and let String drop the trailing zeros, so 50 reads as
  // "50 kg" and 62.5 reads as "62.5 kg".
  return `${Math.round(value * 100) / 100} ${unit}`;
}

export function progressionHint({
  lastSession,
  repMin,
  repMax,
  increment,
  unit = "kg",
}: ProgressionInput): ProgressionHint {
  const working = lastSession.filter((s) => !s.isWarmup && s.reps > 0);

  if (working.length === 0) {
    return {
      kind: "first-time",
      text: `First time. Pick a load you control for ${repMin} to ${repMax}.`,
    };
  }

  const everySetToppedOut = working.every((s) => s.reps >= repMax);

  if (everySetToppedOut) {
    // All sets cleared the top of the range, so the load goes up. Base it on
    // the heaviest working set: that is the load being progressed, and it is
    // what a lifter reads off the bar.
    const previousWeight = Math.max(...working.map((s) => s.weight));
    const targetWeight = previousWeight + increment;
    return {
      kind: "add-weight",
      targetWeight,
      previousWeight,
      increment,
      text: `Every set hit ${repMax}. Go up to ${formatWeight(targetWeight, unit)}.`,
    };
  }

  // Otherwise beat last session by one rep on the first set that fell short.
  const index = working.findIndex((s) => s.reps < repMax);
  const set = working[index];
  const targetReps = set.reps + 1;

  return {
    kind: "add-rep",
    targetWeight: set.weight,
    setNumber: index + 1,
    targetReps,
    text: `Hold ${formatWeight(set.weight, unit)}. Beat set ${index + 1}: ${targetReps} reps.`,
  };
}

/**
 * Resolves the weight step for an exercise: the per-exercise override the user
 * typed in the Plan editor, falling back to their profile default.
 */
export function resolveIncrement(
  perExercise: number | null | undefined,
  profileDefault: number,
): number {
  if (typeof perExercise === "number" && Number.isFinite(perExercise) && perExercise > 0) {
    return perExercise;
  }
  return profileDefault;
}
