/**
 * Supabase schema types.
 *
 * Hand-written to match supabase/migrations/*.sql. Once you have a project you
 * can regenerate them with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/types/database.ts
 * Keep the two in sync: this file is the contract the sync queue writes against.
 */

export type Unit = "kg" | "lb";

export interface ProfileRow {
  id: string;
  display_name: string;
  unit: Unit;
  protein_target_g_per_kg: number;
  default_increment: number;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseRow {
  id: string;
  /** null means the shared global library. */
  owner_id: string | null;
  name: string;
  equipment: string | null;
  primary_muscle: string;
  secondary_muscles: string[];
  created_at: string;
  updated_at: string;
}

export interface TemplateRow {
  id: string;
  owner_id: string;
  name: string;
  day_order: number;
  is_rest_day: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateExerciseRow {
  id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  /** Null falls back to profiles.default_increment. */
  increment: number | null;
  /**
   * What an unlogged set opens at when there is no history to copy. Null
   * means no opinion, which seeds 0. Never consulted once a set is logged.
   */
  start_weight: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutRow {
  id: string;
  user_id: string;
  template_id: string | null;
  /**
   * The workout day's name, snapshotted when the workout started.
   *
   * Not derived from template_id on read: template_id is ON DELETE SET NULL and
   * a template can be renamed, either of which would orphan or silently rewrite
   * a history that the per-day volume trend depends on. Null means an ad-hoc
   * workout with no day.
   */
  day_name: string | null;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetLogRow {
  id: string;
  workout_id: string;
  user_id: string;
  exercise_id: string;
  set_index: number;
  weight: number;
  reps: number;
  rir: number | null;
  is_warmup: boolean;
  is_drop_set: boolean;
  completed_at: string;
  updated_at: string;
}

export interface BodyweightLogRow {
  id: string;
  user_id: string;
  /** ISO date, no time component: "2026-10-25". */
  date: string;
  weight: number;
  created_at: string;
  updated_at: string;
}

export interface ProteinLogRow {
  id: string;
  user_id: string;
  date: string;
  grams: number;
  created_at: string;
  updated_at: string;
}

/** Columns the database fills in for us when they are omitted. */
type Defaulted = "created_at" | "updated_at";

type TableDef<Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, (Defaulted & keyof Row) | Optional> &
    Partial<Pick<Row, (Defaulted & keyof Row) | Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, "display_name" | "unit" | "protein_target_g_per_kg" | "default_increment" | "onboarded_at">;
      exercises: TableDef<ExerciseRow, "id" | "equipment" | "secondary_muscles">;
      templates: TableDef<TemplateRow, "id" | "day_order" | "is_rest_day">;
      template_exercises: TableDef<TemplateExerciseRow, "id" | "position" | "sets" | "rep_min" | "rep_max" | "rest_seconds" | "increment" | "notes">;
      workouts: TableDef<WorkoutRow, "id" | "template_id" | "day_name" | "started_at" | "finished_at" | "notes">;
      set_logs: TableDef<SetLogRow, "id" | "rir" | "is_warmup" | "is_drop_set" | "completed_at">;
      bodyweight_logs: TableDef<BodyweightLogRow, "id">;
      protein_logs: TableDef<ProteinLogRow, "id">;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

/** Every table the sync queue can write to. */
export type SyncableTable =
  | "profiles"
  | "exercises"
  | "templates"
  | "template_exercises"
  | "workouts"
  | "set_logs"
  | "bodyweight_logs"
  | "protein_logs";
