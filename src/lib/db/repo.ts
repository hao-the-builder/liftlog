"use client";

/**
 * Reads and domain writes against the local database.
 *
 * Everything the UI renders comes from here. No function in this file touches
 * the network: the sync engine keeps IndexedDB current in the background, and
 * the screens stay instant whether or not there is signal.
 */

import type {
  BodyweightLogRow,
  ExerciseRow,
  ProfileRow,
  ProteinLogRow,
  SetLogRow,
  TemplateExerciseRow,
  TemplateRow,
} from "@/lib/types/database";
import { db } from "./schema";
import { localPut, newId, nowIso } from "./outbox";

// ---------------------------------------------------------------------------
// Dates. All day bucketing is local time: a 23:50 workout belongs to that day,
// not to tomorrow in UTC.
// ---------------------------------------------------------------------------

export function toLocalDateString(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(userId: string): Promise<ProfileRow | undefined> {
  return db().profiles.get(userId);
}

export async function saveProfile(profile: ProfileRow): Promise<ProfileRow> {
  return localPut("profiles", profile as never) as Promise<ProfileRow>;
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export async function listExercises(): Promise<ExerciseRow[]> {
  const all = await db().exercises.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function exerciseMap(): Promise<Map<string, ExerciseRow>> {
  const all = await db().exercises.toArray();
  return new Map(all.map((e) => [e.id, e]));
}

export async function createCustomExercise(input: {
  ownerId: string;
  name: string;
  equipment: string | null;
  primaryMuscle: string;
  secondaryMuscles: string[];
}): Promise<ExerciseRow> {
  const row: ExerciseRow = {
    id: newId(),
    owner_id: input.ownerId,
    name: input.name.trim(),
    equipment: input.equipment,
    primary_muscle: input.primaryMuscle,
    secondary_muscles: input.secondaryMuscles,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  return localPut("exercises", row as never) as Promise<ExerciseRow>;
}

// ---------------------------------------------------------------------------
// Templates and the rotation
// ---------------------------------------------------------------------------

export async function listTemplates(): Promise<TemplateRow[]> {
  const all = await db().templates.toArray();
  return all.sort(
    (a, b) => a.day_order - b.day_order || a.created_at.localeCompare(b.created_at),
  );
}

export async function listTemplateExercises(templateId: string): Promise<TemplateExerciseRow[]> {
  const rows = await db().templateExercises.where("template_id").equals(templateId).toArray();
  return rows.sort((a, b) => a.position - b.position);
}

/**
 * The next day in the user's rotation.
 *
 * The rotation is just the templates in day_order, and a rest day is one of
 * them. Position is derived from the last finished workout rather than stored,
 * so it stays correct no matter which device logged it. Marking a rest day
 * done writes a zero-set workout, which is what moves the rotation past it.
 */
export async function nextTemplate(): Promise<TemplateRow | null> {
  const templates = await listTemplates();
  if (templates.length === 0) return null;

  const finished = await db()
    .workouts.orderBy("started_at")
    .reverse()
    .filter((w) => w.finished_at !== null && w.template_id !== null)
    .first();

  if (!finished?.template_id) return templates[0];

  const index = templates.findIndex((t) => t.id === finished.template_id);
  if (index === -1) return templates[0];
  return templates[(index + 1) % templates.length];
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export async function activeWorkout() {
  return db().workouts.filter((w) => w.finished_at === null).first();
}

export async function startWorkout(userId: string, templateId: string | null) {
  const row = {
    id: newId(),
    user_id: userId,
    template_id: templateId,
    started_at: nowIso(),
    finished_at: null,
    notes: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  return localPut("workouts", row as never);
}

export async function finishWorkout(workoutId: string) {
  const workout = await db().workouts.get(workoutId);
  if (!workout) return null;
  return localPut("workouts", { ...workout, finished_at: nowIso() } as never);
}

export async function setWorkoutNotes(workoutId: string, notes: string) {
  const workout = await db().workouts.get(workoutId);
  if (!workout) return null;
  return localPut("workouts", { ...workout, notes: notes || null } as never);
}

/** Records a completed rest day so the rotation moves on. */
export async function completeRestDay(userId: string, templateId: string) {
  const at = nowIso();
  const row = {
    id: newId(),
    user_id: userId,
    template_id: templateId,
    started_at: at,
    finished_at: at,
    notes: null,
    created_at: at,
    updated_at: at,
  };
  return localPut("workouts", row as never);
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

export async function setsForWorkout(workoutId: string): Promise<SetLogRow[]> {
  const rows = await db().setLogs.where("workout_id").equals(workoutId).toArray();
  return rows.sort(
    (a, b) => a.set_index - b.set_index || a.completed_at.localeCompare(b.completed_at),
  );
}

export async function allSetsForExercise(exerciseId: string): Promise<SetLogRow[]> {
  const rows = await db().setLogs.where("exercise_id").equals(exerciseId).toArray();
  return rows.sort((a, b) => a.completed_at.localeCompare(b.completed_at));
}

/**
 * The sets from the most recent completed session for this exercise, which is
 * what the Today screen prefills from and what the progression hint reads.
 * The workout in progress is excluded so a half-finished session never becomes
 * its own reference.
 */
export async function lastSessionSets(
  exerciseId: string,
  excludeWorkoutId?: string,
): Promise<{ sets: SetLogRow[]; performedAt: string | null }> {
  const rows = await db().setLogs.where("exercise_id").equals(exerciseId).toArray();
  const candidates = rows.filter((r) => r.workout_id !== excludeWorkoutId);
  if (candidates.length === 0) return { sets: [], performedAt: null };

  candidates.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const mostRecentWorkout = candidates[0].workout_id;

  const sets = candidates
    .filter((r) => r.workout_id === mostRecentWorkout)
    .sort((a, b) => a.set_index - b.set_index);

  return { sets, performedAt: sets[0]?.completed_at ?? null };
}

export interface LogSetInput {
  id?: string;
  userId: string;
  workoutId: string;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  rir?: number | null;
  isWarmup?: boolean;
  isDropSet?: boolean;
}

export async function logSet(input: LogSetInput): Promise<SetLogRow> {
  const row: SetLogRow = {
    id: input.id ?? newId(),
    workout_id: input.workoutId,
    user_id: input.userId,
    exercise_id: input.exerciseId,
    set_index: input.setIndex,
    weight: input.weight,
    reps: input.reps,
    rir: input.rir ?? null,
    is_warmup: input.isWarmup ?? false,
    is_drop_set: input.isDropSet ?? false,
    completed_at: nowIso(),
    updated_at: nowIso(),
  };
  return localPut("set_logs", row as never) as Promise<SetLogRow>;
}

export async function updateSet(row: SetLogRow): Promise<SetLogRow> {
  return localPut("set_logs", row as never) as Promise<SetLogRow>;
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

export async function listBodyweight(): Promise<BodyweightLogRow[]> {
  const rows = await db().bodyweightLogs.toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function latestBodyweight(): Promise<BodyweightLogRow | null> {
  const rows = await listBodyweight();
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

/** One row per day, so logging twice in a day corrects rather than duplicates. */
export async function recordBodyweight(userId: string, weight: number, date = toLocalDateString()) {
  const existing = await db().bodyweightLogs.where("[user_id+date]").equals([userId, date]).first();
  const row: BodyweightLogRow = {
    id: existing?.id ?? newId(),
    user_id: userId,
    date,
    weight,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  return localPut("bodyweight_logs", row as never) as Promise<BodyweightLogRow>;
}

export async function listProtein(): Promise<ProteinLogRow[]> {
  const rows = await db().proteinLogs.toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function proteinForDate(userId: string, date = toLocalDateString()) {
  return db().proteinLogs.where("[user_id+date]").equals([userId, date]).first();
}

/** Adds to the day's running total. Pass a negative number to correct down. */
export async function addProtein(userId: string, grams: number, date = toLocalDateString()) {
  const existing = await proteinForDate(userId, date);
  const total = Math.max(0, (existing?.grams ?? 0) + grams);
  const row: ProteinLogRow = {
    id: existing?.id ?? newId(),
    user_id: userId,
    date,
    grams: total,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  return localPut("protein_logs", row as never) as Promise<ProteinLogRow>;
}

export async function setProtein(userId: string, grams: number, date = toLocalDateString()) {
  const existing = await proteinForDate(userId, date);
  const row: ProteinLogRow = {
    id: existing?.id ?? newId(),
    user_id: userId,
    date,
    grams: Math.max(0, grams),
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  return localPut("protein_logs", row as never) as Promise<ProteinLogRow>;
}
