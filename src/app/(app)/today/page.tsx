"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { ExerciseBlock, type PlannedExercise } from "@/components/today/exercise-block";
import { ExercisePicker } from "@/components/today/exercise-picker";
import { FinishSummary } from "@/components/today/finish-summary";
import { StartCard } from "@/components/today/start-card";
import { useSession } from "@/components/providers/session-provider";
import { useRestTimer } from "@/lib/timer/use-rest-timer";
import { useClientValue, useNow } from "@/lib/hooks/use-now";
import { db } from "@/lib/db/schema";
import {
  activeWorkout,
  completeRestDay,
  finishWorkout,
  listTemplates,
  nextTemplate,
  startWorkout,
} from "@/lib/db/repo";
import { resolveIncrement } from "@/lib/logic/progression";
import type { ExerciseRow, Unit, WorkoutRow } from "@/lib/types/database";

export default function TodayPage() {
  const { userId, profile } = useSession();
  const [summaryFor, setSummaryFor] = useState<WorkoutRow | null>(null);

  const workout = useLiveQuery(() => activeWorkout(), []);
  const templates = useLiveQuery(() => listTemplates(), []);
  const next = useLiveQuery(() => nextTemplate(), [templates]);

  if (!userId) return null;

  const unit = profile?.unit ?? "kg";
  const templateName = templates?.find((t) => t.id === workout?.template_id)?.name;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pb-8">
      {workout ? (
        <>
          <WorkoutHeader workout={workout} templateName={templateName} />
          {/* Keyed by workout so every per-session choice, swaps and added
              exercises included, resets when a new session starts. */}
          <ActiveSession
            key={workout.id}
            workout={workout}
            userId={userId}
            unit={unit}
            defaultIncrement={profile?.default_increment ?? 2.5}
            onFinished={setSummaryFor}
          />
        </>
      ) : (
        <>
          <IdleHeader />
          {/* Pushes the card down so its buttons land in the thumb zone. The
              screen is used one-handed, often with a bar in the other. */}
          <div className="min-h-6 flex-1" />
          <StartCard
            next={next ?? null}
            hasTemplates={(templates?.length ?? 0) > 0}
            onStart={(templateId) => void startWorkout(userId, templateId)}
            onRestDone={(templateId) => void completeRestDay(userId, templateId)}
          />
        </>
      )}

      <FinishSummary
        open={summaryFor !== null}
        workout={summaryFor}
        unit={unit}
        onClose={() => setSummaryFor(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The session in progress
// ---------------------------------------------------------------------------

function ActiveSession({
  workout,
  userId,
  unit,
  defaultIncrement,
  onFinished,
}: {
  workout: WorkoutRow;
  userId: string;
  unit: Unit;
  defaultIncrement: number;
  onFinished: (workout: WorkoutRow) => void;
}) {
  const timer = useRestTimer();
  const [adding, setAdding] = useState(false);
  const [swapping, setSwapping] = useState<PlannedExercise | null>(null);
  /** Session-local, so swapping an exercise never edits the saved plan. */
  const [swaps, setSwaps] = useState<Record<string, ExerciseRow>>({});
  const [extraExercises, setExtraExercises] = useState<ExerciseRow[]>([]);

  const planned = useLiveQuery(async () => {
    const rows = workout.template_id
      ? (
          await db().templateExercises.where("template_id").equals(workout.template_id).toArray()
        ).sort((a, b) => a.position - b.position)
      : [];

    const fromTemplate: PlannedExercise[] = [];
    for (const row of rows) {
      const exercise = await db().exercises.get(row.exercise_id);
      if (!exercise) continue;
      fromTemplate.push({
        key: row.id,
        exerciseId: row.exercise_id,
        name: exercise.name,
        targetSets: row.sets,
        repMin: row.rep_min,
        repMax: row.rep_max,
        restSeconds: row.rest_seconds,
        increment: resolveIncrement(row.increment, defaultIncrement),
        notes: row.notes,
      });
    }

    // Anything logged in this workout that the template does not cover, so a
    // reload mid-session never loses an exercise that was added on the fly.
    const logged = await db().setLogs.where("workout_id").equals(workout.id).toArray();
    const known = new Set(fromTemplate.map((p) => p.exerciseId));
    const adhoc: PlannedExercise[] = [];
    for (const exerciseId of new Set(logged.map((s) => s.exercise_id))) {
      if (known.has(exerciseId)) continue;
      const exercise = await db().exercises.get(exerciseId);
      if (!exercise) continue;
      known.add(exerciseId);
      adhoc.push(adhocPlan(exercise, defaultIncrement));
    }

    return [...fromTemplate, ...adhoc];
  }, [workout.id, workout.template_id, defaultIncrement]);

  const exercises = useMemo(() => {
    const base = (planned ?? []).map((plan) => {
      const swap = swaps[plan.key];
      return swap ? { ...plan, exerciseId: swap.id, name: swap.name } : plan;
    });
    const seen = new Set(base.map((p) => p.exerciseId));
    const extras = extraExercises
      .filter((e) => !seen.has(e.id))
      .map((e) => adhocPlan(e, defaultIncrement));
    return [...base, ...extras];
  }, [planned, swaps, extraExercises, defaultIncrement]);

  const done =
    useLiveQuery(
      () => db().setLogs.where("workout_id").equals(workout.id).count(),
      [workout.id],
    ) ?? 0;

  const plannedSets = exercises.reduce((total, plan) => total + plan.targetSets, 0);

  const finish = async () => {
    const finished = (await finishWorkout(workout.id)) as WorkoutRow | null;
    await timer.skip();
    onFinished(finished ?? workout);
  };

  return (
    <>
      <SessionProgress done={done} target={Math.max(plannedSets, done)} />

      <div className="mt-4 space-y-3">
        {exercises.map((plan) => (
          <ExerciseBlock
            key={plan.key}
            workoutId={workout.id}
            userId={userId}
            unit={unit}
            plan={plan}
            onLogged={(seconds, name) => void timer.start(seconds, name)}
            onSwap={setSwapping}
          />
        ))}
      </div>

      {exercises.length === 0 && (
        <p className="rounded-surface bg-surface px-5 py-8 text-center text-sm text-muted">
          Empty session. Add the first exercise to start logging.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Button block onClick={() => setAdding(true)}>
          <Plus size={16} weight="bold" />
          Add exercise
        </Button>
        <Button variant="primary" size="lg" block onClick={() => void finish()}>
          Finish workout
        </Button>
      </div>

      <ExercisePicker
        open={adding}
        title="Add an exercise"
        onClose={() => setAdding(false)}
        onPick={(exercise) => {
          setExtraExercises((current) => [...current, exercise]);
          setAdding(false);
        }}
      />

      <ExercisePicker
        open={swapping !== null}
        title={swapping ? `Swap ${swapping.name}` : "Swap exercise"}
        onClose={() => setSwapping(null)}
        onPick={(exercise) => {
          if (swapping) setSwaps((current) => ({ ...current, [swapping.key]: exercise }));
          setSwapping(null);
        }}
      />
    </>
  );
}

function adhocPlan(exercise: ExerciseRow, increment: number): PlannedExercise {
  return {
    key: `adhoc:${exercise.id}`,
    exerciseId: exercise.id,
    name: exercise.name,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    restSeconds: 120,
    increment,
    notes: null,
  };
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

function IdleHeader() {
  // Blank during prerender and hydration: this page is a static shell, so a
  // date rendered on the server would be the build date.
  const today = useClientValue(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    "",
  );

  return (
    <header className="py-5">
      <h1 className="text-2xl font-bold tracking-tight">Today</h1>
      <p className="mt-0.5 min-h-5 text-sm text-muted">{today}</p>
    </header>
  );
}

function WorkoutHeader({
  workout,
  templateName,
}: {
  workout: WorkoutRow;
  templateName?: string;
}) {
  const now = useNow(30_000);
  const minutes =
    now === 0 ? null : Math.max(0, Math.floor((now - new Date(workout.started_at).getTime()) / 60000));

  return (
    <header className="py-5">
      <h1 className="truncate text-2xl font-bold tracking-tight">{templateName ?? "Workout"}</h1>
      <p className="mt-0.5 min-h-5 text-sm text-muted">
        {minutes === null ? null : (
          <>
            Started <span className="tnum">{formatElapsed(minutes)}</span> ago
          </>
        )}
      </p>
    </header>
  );
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function SessionProgress({ done, target }: { done: number; target: number }) {
  const percent = target > 0 ? Math.min(100, (done / target) * 100) : 0;

  return (
    <div className="rounded-surface bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted">
          <span className="tnum font-semibold text-text">{done}</span> of{" "}
          <span className="tnum">{target}</span> sets done
        </p>
        <p className="tnum text-xs text-faint">{Math.round(percent)}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label="Session progress"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full bg-volt transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
