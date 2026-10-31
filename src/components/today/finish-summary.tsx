"use client";

import { useEffect, useState } from "react";
import { Trophy } from "@phosphor-icons/react/dist/ssr";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/schema";
import { setsForWorkout } from "@/lib/db/repo";
import { prLabel, replayPrs, type PrKind } from "@/lib/logic/prs";
import { formatChange, formatTonnage, sessionTonnage } from "@/lib/logic/tonnage";
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
  /**
   * Change against the last time this same workout day was trained, or null
   * when there is no previous one to compare against. Same day against same
   * day: comparing a push session to whatever happened to come before it would
   * mostly measure which day of the split it was.
   */
  changeVsLastTime: number | null;
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

      // One definition of "total weight moved" in the app, shared with the
      // per-day trend on Progress, so the number here and the newest point
      // there can never disagree.
      const tonnage = sessionTonnage(
        sets.map((s) => ({
          workoutId: s.workout_id,
          weight: s.weight,
          reps: s.reps,
          isWarmup: s.is_warmup,
        })),
      );

      // Walk back through earlier sessions of this same day for the most recent
      // one that actually had working sets, so a logged rest day or an
      // abandoned session is not what today gets measured against.
      let changeVsLastTime: number | null = null;
      if (workout.day_name) {
        const earlier = (await db().workouts.toArray())
          .filter(
            (w) =>
              w.day_name === workout.day_name &&
              w.id !== workout.id &&
              w.finished_at !== null &&
              w.started_at < workout.started_at,
          )
          .sort((a, b) => b.started_at.localeCompare(a.started_at));

        for (const candidate of earlier) {
          const previousSets = await setsForWorkout(candidate.id);
          const previous = sessionTonnage(
            previousSets.map((s) => ({
              workoutId: s.workout_id,
              weight: s.weight,
              reps: s.reps,
              isWarmup: s.is_warmup,
            })),
          );
          if (previous.sets > 0 && previous.total > 0) {
            changeVsLastTime = (tonnage.total - previous.total) / previous.total;
            break;
          }
        }
      }

      if (cancelled) return;
      setSummary({
        totalSets: sets.length,
        workingSets: working.length,
        volume: tonnage.total,
        minutes,
        changeVsLastTime,
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
            label={`Total ${unit}`}
            value={summary ? formatTonnage(summary.volume) : "--"}
          />
        </dl>

        {/* The comparison is what makes the total mean anything. Without it the
            number is just large. */}
        {summary?.changeVsLastTime !== null && summary !== null && (
          <p className="mt-3 text-center text-xs text-muted">
            <span
              className={
                summary.changeVsLastTime > 0 ? "font-medium text-text" : "font-medium text-muted"
              }
            >
              {formatChange(summary.changeVsLastTime)}
            </span>{" "}
            on your last {workout?.day_name ?? "session"}
          </p>
        )}

        {summary && summary.prs.length > 0 && (
          <section className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-medium text-record">
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
                  <p className="tnum shrink-0 text-sm font-medium text-record">
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
      <dd className="tnum text-xl font-medium text-text">{value}</dd>
      <dt className="mt-0.5 font-mono text-[10px] font-light uppercase tracking-[0.18em] text-faint">{label}</dt>
    </div>
  );
}
