"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretLeft, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ExercisePicker } from "@/components/today/exercise-picker";
import { CustomExerciseSheet } from "@/components/plan/custom-exercise-sheet";
import { PlanExerciseRow } from "@/components/plan/plan-exercise-row";
import { useSession } from "@/components/providers/session-provider";
import { db } from "@/lib/db/schema";
import { localDelete, localPut, newId, nowIso } from "@/lib/db/outbox";
import { listTemplateExercises } from "@/lib/db/repo";
import type { ExerciseRow, TemplateExerciseRow } from "@/lib/types/database";

export default function TemplateEditorPage() {
  const router = useRouter();
  const { userId, profile } = useSession();
  const templateId = String(useParams().templateId ?? "");

  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const template = useLiveQuery(() => db().templates.get(templateId), [templateId]);
  const rows = useLiveQuery(() => listTemplateExercises(templateId), [templateId]);
  const exercises = useLiveQuery(async () => {
    const all = await db().exercises.toArray();
    return new Map(all.map((e) => [e.id, e]));
  }, []);

  if (!userId) return null;

  if (template === undefined) {
    return <div className="px-4 py-6 text-sm text-muted">Loading.</div>;
  }
  if (template === null) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-muted">That day is gone.</p>
        <Link href="/plan" className="mt-3 inline-block text-sm text-volt hover:underline">
          Back to plan
        </Link>
      </div>
    );
  }

  const rename = async (name: string) => {
    await localPut("templates", { ...template, name } as never);
  };

  const toggleRestDay = async () => {
    await localPut("templates", { ...template, is_rest_day: !template.is_rest_day } as never);
  };

  const addExercise = async (exercise: ExerciseRow) => {
    const row: TemplateExerciseRow = {
      id: newId(),
      template_id: templateId,
      exercise_id: exercise.id,
      position: rows?.length ?? 0,
      sets: 3,
      rep_min: 8,
      rep_max: 12,
      rest_seconds: 120,
      increment: null,
      start_weight: null,
      notes: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await localPut("template_exercises", row as never);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const list = rows ?? [];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    await localPut("template_exercises", { ...list[index], position: target } as never);
    await localPut("template_exercises", { ...list[target], position: index } as never);
  };

  const removeDay = async () => {
    for (const row of rows ?? []) await localDelete("template_exercises", row.id);
    await localDelete("templates", templateId);
    router.replace("/plan");
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <header className="flex items-center gap-1 py-4">
        <Link
          href="/plan"
          aria-label="Back to plan"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-ctl text-muted transition-colors duration-150 ease-out hover:bg-surface hover:text-text"
        >
          <CaretLeft size={20} />
        </Link>
        <input
          value={template.name}
          onChange={(e) => void rename(e.target.value)}
          aria-label="Day name"
          className="min-w-0 flex-1 rounded-ctl border border-transparent bg-transparent px-2 py-1.5 text-xl font-bold tracking-tight text-text transition-colors duration-150 ease-out focus:border-line-strong focus:bg-surface-2 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete this day"
          className="flex h-11 w-11 items-center justify-center rounded-ctl text-faint transition-colors duration-150 ease-out hover:bg-surface hover:text-danger"
        >
          <Trash size={18} />
        </button>
      </header>

      <label className="flex items-center justify-between gap-3 rounded-surface bg-surface px-4 py-3.5">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-text">Rest day</span>
          <span className="mt-0.5 block text-xs text-muted">
            Keeps its place in the rotation without any exercises.
          </span>
        </span>
        <input
          type="checkbox"
          checked={template.is_rest_day}
          onChange={() => void toggleRestDay()}
          className="h-6 w-6 shrink-0 accent-[var(--color-volt)]"
        />
      </label>

      {!template.is_rest_day && (
        <>
          <div className="mt-4 space-y-2">
            {(rows ?? []).map((row, index) => (
              <PlanExerciseRow
                key={row.id}
                row={row}
                index={index}
                total={rows?.length ?? 0}
                exerciseName={exercises?.get(row.exercise_id)?.name ?? "Exercise"}
                unit={profile?.unit ?? "kg"}
                defaultIncrement={profile?.default_increment ?? 2.5}
                onMove={(direction) => void move(index, direction)}
                onRemove={() => void localDelete("template_exercises", row.id)}
              />
            ))}
          </div>

          {(rows?.length ?? 0) === 0 && (
            <p className="mt-4 rounded-surface bg-surface px-5 py-8 text-center text-sm text-muted">
              Nothing in this day yet. Add the first exercise.
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2">
            <Button variant="primary" block onClick={() => setPicking(true)}>
              <Plus size={16} weight="bold" />
              Add exercise
            </Button>
            <Button block onClick={() => setCreating(true)}>
              Create a custom exercise
            </Button>
          </div>
        </>
      )}

      <ExercisePicker
        open={picking}
        title="Add an exercise"
        onClose={() => setPicking(false)}
        onPick={(exercise) => {
          void addExercise(exercise);
          setPicking(false);
        }}
      />

      <CustomExerciseSheet
        open={creating}
        ownerId={userId}
        onClose={() => setCreating(false)}
        onCreated={(exercise) => void addExercise(exercise)}
      />

      <Sheet
        open={confirmDelete}
        title={`Delete ${template.name}?`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="danger" size="lg" block onClick={() => void removeDay()}>
              Delete this day
            </Button>
            <Button size="lg" block onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        }
      >
        <p className="px-4 py-5 text-sm text-muted">
          The day and its exercise list go. Workouts you already logged against it stay in your
          history.
        </p>
      </Sheet>
    </div>
  );
}
