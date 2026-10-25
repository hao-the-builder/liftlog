/**
 * The closed vocabulary.
 *
 * The weekly sets-per-muscle chart groups on these exact strings, and so does
 * the global exercise library in supabase/migrations/0003_exercise_library.sql.
 * A custom exercise has to pick from this list, otherwise its volume would
 * silently land in a bucket of its own that no chart ever shows.
 */
export const MUSCLES = [
  "chest",
  "front delts",
  "side delts",
  "rear delts",
  "lats",
  "upper back",
  "traps",
  "lower back",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "obliques",
] as const;

export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "other",
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

/** Rough grouping, used to order the volume chart so related bars sit together. */
export const MUSCLE_GROUPS: Record<string, Muscle[]> = {
  Push: ["chest", "front delts", "side delts", "triceps"],
  Pull: ["lats", "upper back", "rear delts", "traps", "biceps", "forearms"],
  Legs: ["quads", "hamstrings", "glutes", "calves"],
  Core: ["abs", "obliques", "lower back"],
};

/** Chart order: grouped, then within the group as listed above. */
export const MUSCLE_ORDER: string[] = Object.values(MUSCLE_GROUPS).flat();
