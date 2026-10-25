"use client";

import { useEffect, useState } from "react";
import { Trophy } from "@phosphor-icons/react/dist/ssr";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/schema";
import { setsForWorkout } from "@/lib/db/repo";
import { prLabel, replayPrs, type PrKind } from "@/lib/logic/prs";
import type { Unit, WorkoutRow } from "@/lib/types/database";

interface Props {
  open: boolean;
  workout: WorkoutRow | null;
  unit: Unit;
  onClose: () => void;
}

interface Summary {
  totalSets: number;
  workingSets: number;
  volume: number;
  minutes: number;
  prs: { exercise: string; kind: PrKind; weight: number; reps: number }[];
}

/**
 * What the session added up to.
 *
 * The records are recomputed from the database rather than remembered from
 * the session, by replaying the workout's sets against the history that came
 * before it. That way the summary is right even if the app was reloaded or
 * the phone died halfway through.
 */
export function FinishSummary({ open, workout, unit, onClose }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!open || !workout) return;
    let cancelled = false;

    void (async () => {
      const sets = await setsForWorkout(workout.id);
      const working = sets.filter((s) => !s.is_warmup);

      const byExercise = new Map<string, typeof sets>();
      for (const set of sets) {
        const list = byExercise.get(set.exercise_id);
        if (list) list.push(set);
        else byExercise.set(set.exercise_id, [set]);
      }

      const prs: Summary["prs"] = [];
      for (const [exerciseId, sessionSets] of byExercise) {
        const exercise = await db().exercises.get(exerciseId);
        const all = await db().setLogs.where("exercise_id").equals(exerciseId).toArray();
        const before = all
          .filter((s) => s.workout_id !== workout.id)
          .filter((s) => s.completed_at < workout.started_at)
          .map((s) => ({ weight: s.weight, reps: s.reps, isWarmup: s.is_warmup }));

        const ordered = [...sessionSets].sort((a, b) =>
          a.completed_at.localeCompare(b.completed_at),
        );
        const hits = replayPrs(
          before,
          ordered.map((s) => ({ weight: s.weight, reps: s.reps, isWarmup: s.is_warmup })),
        );

        hits.forEach((kinds, index) => {
          for (const kind of kinds) {
            prs.push({
              exercise: exercise?.name ?? "Exercise",
              kind,
              weight: ordered[index].weight,
              reps: ordered[index].reps,
            });
          }
        });
      }

      const finished = workout.finished_at ? new Date(workout.finished_at) : new Date();
      const minutes = Math.max(
        0,
        Math.round((finished.getTime() - new Date(workout.started_at).getTime()) / 60000),
      );

      if (cancelled) return;
      setSummary({
        totalSets: sets.length,
        workingSets: working.length,
        volume: working.reduce((total, s) => total + s.weight * s.reps, 0),
        minutes,
        prs,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, workout]);

  return (
    <Sheet
      open={open}
      title="Session done"
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" block onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="px-4 py-5">
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-surface bg-line">
          <Stat label="Sets" value={summary ? String(summary.workingSets) : "--"} />
          <Stat label="Minutes" value={summary ? String(summary.minutes) : "--"} />
          <Stat
            label={`Volume ${unit}`}
            value={summary ? Math.round(summary.volume).toLocaleString() : "--"}
          />
        </dl>

        {summary && summary.prs.length > 0 && (
          <section className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-pr">
              <Trophy size={16} weight="fill" />
              {summary.prs.length === 1
                ? "1 record"
                : `${summary.prs.length} records`}
            </h3>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-surface bg-surface-2">
              {summary.prs.map((pr, index) => (
                <li key={index} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{pr.exercise}</p>
                    <p className="text-xs text-muted">{prLabel(pr.kind)}</p>
                  </div>
                  <p className="tnum shrink-0 text-sm font-semibold text-pr">
                    {pr.weight} {unit} x {pr.reps}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary && summary.prs.length === 0 && (
          <p className="mt-6 text-sm text-muted">
            No records this time. Reps add up faster than records do.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 px-3 py-4 text-center">
      <dd className="tnum text-xl font-bold text-text">{value}</dd>
      <dt className="mt-0.5 text-[11px] uppercase tracking-wide text-faint">{label}</dt>
    </div>
  );
}
