"use client";

/**
 * Everything the user has, as a folder of CSVs in one zip.
 *
 * Built from the local database rather than from Supabase, so the export
 * works offline and is exactly what the app is showing. Ids are included
 * alongside human-readable names: the names make it usable in a spreadsheet,
 * the ids make it re-importable.
 */

import { db } from "@/lib/db/schema";
import { toCsv } from "./csv";
import { createZip, type ZipEntry } from "./zip";

const encoder = new TextEncoder();

function csvEntry(name: string, headers: string[], rows: unknown[][]): ZipEntry {
  return { name, data: encoder.encode(toCsv(headers, rows)) };
}

export async function buildExportZip(): Promise<Uint8Array> {
  const d = db();
  const [
    profiles,
    exercises,
    templates,
    templateExercises,
    workouts,
    setLogs,
    bodyweight,
    protein,
  ] = await Promise.all([
    d.profiles.toArray(),
    d.exercises.toArray(),
    d.templates.toArray(),
    d.templateExercises.toArray(),
    d.workouts.toArray(),
    d.setLogs.toArray(),
    d.bodyweightLogs.toArray(),
    d.proteinLogs.toArray(),
  ]);

  const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));
  const templateName = new Map(templates.map((t) => [t.id, t.name]));
  const workoutById = new Map(workouts.map((w) => [w.id, w]));

  const entries: ZipEntry[] = [
    csvEntry(
      "profile.csv",
      ["display_name", "unit", "protein_target_g_per_kg", "default_increment", "created_at"],
      profiles.map((p) => [
        p.display_name,
        p.unit,
        p.protein_target_g_per_kg,
        p.default_increment,
        p.created_at,
      ]),
    ),

    csvEntry(
      "sets.csv",
      [
        "date",
        "completed_at",
        "day",
        "exercise",
        "set_number",
        "weight",
        "reps",
        "rir",
        "warmup",
        "drop_set",
        "workout_id",
        "exercise_id",
        "set_id",
      ],
      [...setLogs]
        .sort((a, b) => a.completed_at.localeCompare(b.completed_at))
        .map((s) => {
          const workout = workoutById.get(s.workout_id);
          return [
            s.completed_at.slice(0, 10),
            s.completed_at,
            workout?.template_id ? (templateName.get(workout.template_id) ?? "") : "",
            exerciseName.get(s.exercise_id) ?? "",
            s.set_index + 1,
            s.weight,
            s.reps,
            s.rir,
            s.is_warmup,
            s.is_drop_set,
            s.workout_id,
            s.exercise_id,
            s.id,
          ];
        }),
    ),

    csvEntry(
      "workouts.csv",
      ["started_at", "finished_at", "day", "notes", "workout_id", "template_id"],
      [...workouts]
        .sort((a, b) => a.started_at.localeCompare(b.started_at))
        .map((w) => [
          w.started_at,
          w.finished_at,
          w.template_id ? (templateName.get(w.template_id) ?? "") : "",
          w.notes,
          w.id,
          w.template_id,
        ]),
    ),

    csvEntry(
      "plan.csv",
      [
        "day_order",
        "day",
        "rest_day",
        "position",
        "exercise",
        "sets",
        "rep_min",
        "rep_max",
        "rest_seconds",
        "increment",
        "notes",
        "template_id",
        "exercise_id",
      ],
      [...templates]
        .sort((a, b) => a.day_order - b.day_order)
        .flatMap((t) => {
          const rows = templateExercises
            .filter((te) => te.template_id === t.id)
            .sort((a, b) => a.position - b.position);
          if (rows.length === 0) {
            return [[t.day_order, t.name, t.is_rest_day, "", "", "", "", "", "", "", "", t.id, ""]];
          }
          return rows.map((te) => [
            t.day_order,
            t.name,
            t.is_rest_day,
            te.position + 1,
            exerciseName.get(te.exercise_id) ?? "",
            te.sets,
            te.rep_min,
            te.rep_max,
            te.rest_seconds,
            te.increment,
            te.notes,
            t.id,
            te.exercise_id,
          ]);
        }),
    ),

    csvEntry(
      "exercises.csv",
      ["name", "equipment", "primary_muscle", "secondary_muscles", "custom", "exercise_id"],
      [...exercises]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => [
          e.name,
          e.equipment,
          e.primary_muscle,
          e.secondary_muscles.join("; "),
          e.owner_id !== null,
          e.id,
        ]),
    ),

    csvEntry(
      "bodyweight.csv",
      ["date", "weight"],
      [...bodyweight].sort((a, b) => a.date.localeCompare(b.date)).map((b) => [b.date, b.weight]),
    ),

    csvEntry(
      "protein.csv",
      ["date", "grams"],
      [...protein].sort((a, b) => a.date.localeCompare(b.date)).map((p) => [p.date, p.grams]),
    ),
  ];

  return createZip(entries);
}

/** Hands the archive to the browser as a download. */
export function downloadZip(bytes: Uint8Array, filename: string): void {
  const view = new Uint8Array(bytes);
  const blob = new Blob([view.buffer as ArrayBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
