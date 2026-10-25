"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretDown, Table } from "@phosphor-icons/react/dist/ssr";
import { Segmented } from "@/components/ui/segmented";
import { ExercisePicker } from "@/components/today/exercise-picker";
import { ExerciseCharts } from "@/components/progress/exercise-chart";
import { VolumeChart, VolumeTable } from "@/components/progress/volume-chart";
import { ExerciseHistory } from "@/components/progress/exercise-history";
import { ChartCard } from "@/components/charts/chart-chrome";
import { useSession } from "@/components/providers/session-provider";
import { useNow } from "@/lib/hooks/use-now";
import { db } from "@/lib/db/schema";
import { compareWeeks, type MuscleMap } from "@/lib/logic/volume";
import { RANGES, sessionSeries, withinRange, type RangeKey } from "@/lib/logic/series";
import type { ExerciseRow } from "@/lib/types/database";

export default function ProgressPage() {
  const { profile } = useSession();
  const unit = profile?.unit ?? "kg";

  const [range, setRange] = useState<RangeKey>("12w");
  const [exercise, setExercise] = useState<ExerciseRow | null>(null);
  const [picking, setPicking] = useState(false);
  const [showTable, setShowTable] = useState(false);

  // One clock for the page, so every range filter agrees on "now".
  const now = useNow(60_000);

  const exercises = useLiveQuery(() => db().exercises.toArray(), []);
  const allSets = useLiveQuery(() => db().setLogs.toArray(), []);

  // The exercise shown by default is the one most recently trained, which is
  // almost always the one being looked up.
  const selected = useMemo(() => {
    if (exercise) return exercise;
    if (!allSets?.length || !exercises?.length) return null;
    const latest = [...allSets].sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
    return exercises.find((e) => e.id === latest.exercise_id) ?? null;
  }, [exercise, allSets, exercises]);

  const muscles = useMemo(() => {
    const map = new Map<string, MuscleMap>();
    for (const e of exercises ?? []) {
      map.set(e.id, {
        primaryMuscle: e.primary_muscle,
        secondaryMuscles: e.secondary_muscles,
      });
    }
    return map;
  }, [exercises]);

  const volumeRows = useMemo(
    () =>
      now === 0
        ? []
        : compareWeeks(
            (allSets ?? []).map((s) => ({
              exerciseId: s.exercise_id,
              completedAt: s.completed_at,
              isWarmup: s.is_warmup,
            })),
            muscles,
            new Date(now),
          ),
    [allSets, muscles, now],
  );

  const points = useMemo(() => {
    if (!selected || !allSets) return [];
    const forExercise = allSets
      .filter((s) => s.exercise_id === selected.id)
      .map((s) => ({
        workoutId: s.workout_id,
        weight: s.weight,
        reps: s.reps,
        isWarmup: s.is_warmup,
        completedAt: s.completed_at,
      }));
    return withinRange(sessionSeries(forExercise), now === 0 ? "all" : range, now);
  }, [selected, allSets, range, now]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <header className="py-5">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="mt-0.5 text-sm text-muted">What moved, and what has not.</p>
      </header>

      {/* Volume section. Its own scope: always this week against last. */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-label font-medium uppercase tracking-wide text-faint">Volume</h2>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="flex min-h-9 items-center gap-1.5 rounded-ctl px-2.5 text-xs font-medium text-muted transition-colors duration-150 ease-out hover:bg-surface hover:text-text"
          >
            <Table size={14} />
            {showTable ? "Chart" : "Table"}
          </button>
        </div>

        {showTable ? (
          <ChartCard title="Weekly sets per muscle" subtitle="This week against last week.">
            <div className="pb-2">
              <VolumeTable rows={volumeRows} />
            </div>
          </ChartCard>
        ) : (
          <VolumeChart rows={volumeRows} />
        )}
      </section>

      {/* Exercise section. One control row above everything it scopes. */}
      <section className="mt-8 space-y-3">
        <h2 className="text-label font-medium uppercase tracking-wide text-faint">Exercise</h2>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex min-h-12 items-center justify-between gap-3 rounded-ctl border border-line bg-surface-2 px-3.5 text-left transition-colors duration-150 ease-out hover:border-line-strong"
          >
            <span className="truncate text-sm font-medium text-text">
              {selected?.name ?? "Pick an exercise"}
            </span>
            <CaretDown size={16} className="shrink-0 text-faint" />
          </button>

          <Segmented
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
          />
        </div>

        {selected ? (
          <>
            <ExerciseCharts points={points} unit={unit} />
            <ExerciseHistory exerciseId={selected.id} unit={unit} range={range} />
          </>
        ) : (
          <p className="rounded-surface bg-surface px-5 py-8 text-center text-sm text-muted">
            Log a workout and your lifts show up here.
          </p>
        )}
      </section>

      <ExercisePicker
        open={picking}
        title="Pick an exercise"
        onClose={() => setPicking(false)}
        onPick={(picked) => {
          setExercise(picked);
          setPicking(false);
        }}
      />
    </div>
  );
}
