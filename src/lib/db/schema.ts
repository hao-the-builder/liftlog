"use client";

/**
 * The local database.
 *
 * Supabase is the source of truth, but nothing in the UI ever waits on it.
 * Every read on the Today screen comes from here, and every write lands here
 * first and goes into the outbox for the sync queue to flush. That is what
 * makes the app usable in a basement gym with no signal.
 *
 * The tables mirror Postgres one for one, so a row can move in either
 * direction without translation.
 */

import Dexie, { type Table } from "dexie";
import type {
  BodyweightLogRow,
  ExerciseRow,
  ProfileRow,
  ProteinLogRow,
  SetLogRow,
  SyncableTable,
  TemplateExerciseRow,
  TemplateRow,
  WorkoutRow,
} from "@/lib/types/database";

/**
 * One pending write. The queue is append-only and drained in order.
 *
 * `rowId` plus the table is the identity of the change, so a row edited five
 * times offline collapses to a single upsert carrying the latest state. That
 * keeps a long offline session cheap to flush and makes retries harmless:
 * the same id upserted twice is one row, not two.
 */
export interface OutboxItem {
  seq?: number;
  table: SyncableTable;
  op: "upsert" | "delete";
  rowId: string;
  /** Full row for an upsert, ignored for a delete. */
  payload: Record<string, unknown>;
  /** Mirrors payload.updated_at so the queue can be reasoned about directly. */
  updatedAt: string;
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
}

/** Small key/value store for sync cursors and the signed-in user. */
export interface MetaRow {
  key: string;
  value: unknown;
}

/** Local-only state for a workout in progress, never synced. */
export interface TimerState {
  key: "rest";
  /** Epoch ms when the rest period ends. Timestamp based, so locking the
   *  phone or backgrounding the app cannot drift it. */
  endsAt: number;
  /** Total length of this rest period in seconds, for the progress ring. */
  totalSeconds: number;
  /** Set when paused: ms left at the moment of pausing. */
  pausedWithMsLeft?: number;
  exerciseName?: string;
}

export class LiftlogDB extends Dexie {
  profiles!: Table<ProfileRow, string>;
  exercises!: Table<ExerciseRow, string>;
  templates!: Table<TemplateRow, string>;
  templateExercises!: Table<TemplateExerciseRow, string>;
  workouts!: Table<WorkoutRow, string>;
  setLogs!: Table<SetLogRow, string>;
  bodyweightLogs!: Table<BodyweightLogRow, string>;
  proteinLogs!: Table<ProteinLogRow, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<MetaRow, string>;
  timers!: Table<TimerState, string>;

  constructor() {
    super("liftlog");
    this.version(1).stores({
      profiles: "id",
      exercises: "id, owner_id, name, primary_muscle",
      templates: "id, owner_id, day_order",
      templateExercises: "id, template_id, [template_id+position]",
      workouts: "id, user_id, started_at, finished_at, template_id",
      setLogs:
        "id, workout_id, exercise_id, completed_at, [exercise_id+completed_at], [workout_id+exercise_id]",
      bodyweightLogs: "id, date, [user_id+date]",
      proteinLogs: "id, date, [user_id+date]",
      outbox: "++seq, [table+rowId], enqueuedAt",
      meta: "key",
      timers: "key",
    });
  }
}

let instance: LiftlogDB | null = null;

export function db(): LiftlogDB {
  if (!instance) instance = new LiftlogDB();
  return instance;
}

/**
 * Wipes everything local. Called on sign-out, and when a different user signs
 * in on the same device, so one person's training never leaks into another's
 * view even for the moment before the first sync completes.
 */
export async function clearLocalDatabase(): Promise<void> {
  const current = instance ?? new LiftlogDB();
  await current.delete();
  instance = null;
}

// --- meta helpers -----------------------------------------------------------

export const META_USER_ID = "userId";
/** ISO timestamp of the newest row seen from the server, per table. */
export const metaCursorKey = (table: SyncableTable) => `cursor:${table}`;

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db().meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db().meta.put({ key, value });
}
