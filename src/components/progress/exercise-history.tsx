"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useNow } from "@/lib/hooks/use-now";
import { RANGES, type RangeKey } from "@/lib/logic/series";
import { epley1RM, roundE1RM } from "@/lib/logic/e1rm";
import type { SetLogRow, Unit } from "@/lib/types/database";

/**
 * Every session for this exercise, set by set.
 *
 * This is also the chart's table twin: the numbers above are all readable
 * here without hovering anything, which is what keeps the tooltips an
 * enhancement rather than the only way to read a value.
 */
export function ExerciseHistory({
  exerciseId,
  unit,
  range,
}: {
  exerciseId: string;
  unit: Unit;
  range: RangeKey;
}) {
  const sets = useLiveQuery(
    () => db().setLogs.where("exercise_id").equals(exerciseId).toArray(),
    [exerciseId],
  );

  // A clock React may read during render. 0 during prerender, which falls
  // through to showing everything rather than filtering against 1970.
  const now = useNow(60_000);

  const sessions = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    const cutoff = days === null || now === 0 ? 0 : now - days * 86_400_000;

    const byWorkout = new Map<string, SetLogRow[]>();
    for (const set of sets ?? []) {
      if (new Date(set.completed_at).getTime() < cutoff) continue;
      const bucket = byWorkout.get(set.workout_id);
      if (bucket) bucket.push(set);
      else byWorkout.set(set.workout_id, [set]);
    }

    return [...byWorkout.values()]
      .map((rows) => rows.sort((a, b) => a.set_index - b.set_index))
      .sort((a, b) => b[0].completed_at.localeCompare(a[0].completed_at));
  }, [sets, range, now]);

  if (sessions.length === 0) return null;

  return (
    <section className="rounded-surface bg-surface">
      <header className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-text">History</h2>
        <p className="mt-0.5 text-xs text-muted">
          <span className="tnum">{sessions.length}</span>{" "}
          {sessions.length === 1 ? "session" : "sessions"} in this range.
        </p>
      </header>

      <ol className="divide-y divide-line">
        {sessions.map((rows) => {
          const date = new Date(rows[0].completed_at);
          const working = rows.filter((r) => !r.is_warmup);
          const best = working.reduce<number | null>((top, row) => {
            const estimate = epley1RM(row.weight, row.reps);
            if (estimate === null) return top;
            return top === null || estimate > top ? estimate : top;
          }, null);

          return (
            <li key={rows[0].workout_id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium text-muted">
                  {date.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                {best !== null && (
                  <p className="text-xs text-faint">
                    e1RM <span className="tnum text-muted">{roundE1RM(best)}</span> {unit}
                  </p>
                )}
              </div>

              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className={row.is_warmup ? "text-xs text-faint" : "text-xs text-text"}
                  >
                    <span className="tnum font-semibold">{row.weight}</span>
                    <span className="text-faint"> x </span>
                    <span className="tnum font-semibold">{row.reps}</span>
                    {row.is_warmup && <span className="text-faint"> warm</span>}
                    {row.is_drop_set && <span className="text-faint"> drop</span>}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
