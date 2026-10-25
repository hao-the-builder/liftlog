/**
 * Personal records.
 *
 * Three kinds are tracked per exercise, and a single set can hit more than one
 * at once:
 *
 *   weight         the heaviest load ever moved for at least one rep
 *   reps-at-weight more reps at a load you have used before
 *   e1rm           the best estimated one-rep max (Epley, 12 reps or fewer)
 *
 * Warm-ups never count. "reps-at-weight" deliberately requires prior history
 * at that exact load: without that rule it would fire on every set at a weight
 * you had simply never tried, which makes the badge meaningless.
 */

import { epley1RM } from "./e1rm";

export type PrKind = "weight" | "reps-at-weight" | "e1rm";

export interface PrCandidate {
  weight: number;
  reps: number;
  isWarmup?: boolean;
}

/** A previously logged set for the same exercise. */
export interface HistorySet {
  weight: number;
  reps: number;
  isWarmup?: boolean;
}

export interface ExercisePrs {
  /** Heaviest load moved for at least one rep. */
  bestWeight: number | null;
  /** Best estimated one-rep max. */
  bestE1RM: number | null;
  /** Most reps achieved, keyed by load. */
  bestRepsByWeight: Map<number, number>;
}

const isCounted = (s: { reps: number; weight: number; isWarmup?: boolean }) =>
  !s.isWarmup && s.reps >= 1 && s.weight > 0;

/** Adds one set to a running summary. Mutates and returns it. */
export function foldSet(prs: ExercisePrs, set: HistorySet): ExercisePrs {
  if (!isCounted(set)) return prs;

  if (prs.bestWeight === null || set.weight > prs.bestWeight) prs.bestWeight = set.weight;

  const e = epley1RM(set.weight, set.reps);
  if (e !== null && (prs.bestE1RM === null || e > prs.bestE1RM)) prs.bestE1RM = e;

  const previous = prs.bestRepsByWeight.get(set.weight);
  if (previous === undefined || set.reps > previous) {
    prs.bestRepsByWeight.set(set.weight, set.reps);
  }

  return prs;
}

/** Folds a set of history rows into the three records we compare against. */
export function summarisePrs(history: HistorySet[]): ExercisePrs {
  const prs: ExercisePrs = {
    bestWeight: null,
    bestE1RM: null,
    bestRepsByWeight: new Map<number, number>(),
  };
  for (const set of history) foldSet(prs, set);
  return prs;
}

/**
 * Replays a session set by set against the history that preceded it.
 *
 * Needed because a record set earlier in the same session raises the bar for
 * the ones after it: going 60x8 then 62.5x8 is two weight records, but 60x8
 * then 60x8 again is one. Used by the finish summary, which has to work even
 * if the app was reloaded mid-workout and the in-memory list is gone.
 */
export function replayPrs(historyBefore: HistorySet[], session: PrCandidate[]): PrKind[][] {
  const running = summarisePrs(historyBefore);
  return session.map((set) => {
    const hits = detectPrs(set, running);
    foldSet(running, set);
    return hits;
  });
}

/**
 * Which records this set breaks, given everything logged for the exercise
 * before it. Returns an empty array for a normal set, which is most of them.
 */
export function detectPrs(candidate: PrCandidate, prior: ExercisePrs): PrKind[] {
  if (!isCounted(candidate)) return [];

  const hits: PrKind[] = [];

  if (prior.bestWeight === null || candidate.weight > prior.bestWeight) {
    hits.push("weight");
  }

  const bestAtThisWeight = prior.bestRepsByWeight.get(candidate.weight);
  if (bestAtThisWeight !== undefined && candidate.reps > bestAtThisWeight) {
    hits.push("reps-at-weight");
  }

  const e = epley1RM(candidate.weight, candidate.reps);
  if (e !== null && (prior.bestE1RM === null || e > prior.bestE1RM)) {
    hits.push("e1rm");
  }

  return hits;
}

/** Convenience wrapper when you have the raw history rather than a summary. */
export function detectPrsAgainstHistory(
  candidate: PrCandidate,
  history: HistorySet[],
): PrKind[] {
  return detectPrs(candidate, summarisePrs(history));
}

const PR_LABELS: Record<PrKind, string> = {
  weight: "Heaviest",
  "reps-at-weight": "Most reps",
  e1rm: "Best e1RM",
};

/** The short label that goes on the badge. */
export function prLabel(kind: PrKind): string {
  return PR_LABELS[kind];
}

/**
 * When a set hits several records at once the badge shows one. Heaviest beats
 * most reps beats best e1RM, because that is the order a lifter cares about.
 */
export function primaryPr(kinds: PrKind[]): PrKind | null {
  if (kinds.includes("weight")) return "weight";
  if (kinds.includes("reps-at-weight")) return "reps-at-weight";
  if (kinds.includes("e1rm")) return "e1rm";
  return null;
}
