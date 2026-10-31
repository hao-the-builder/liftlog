"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Sheet } from "@/components/ui/sheet";
import { listExercises } from "@/lib/db/repo";
import type { ExerciseRow } from "@/lib/types/database";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (exercise: ExerciseRow) => void;
}

/** Picks an exercise from the library, for swapping one out or adding one in. */
export function ExercisePicker({ open, title, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const exercises = useLiveQuery(() => listExercises(), []);

  const matches = useMemo(() => {
    const all = exercises ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        e.primary_muscle.includes(needle) ||
        (e.equipment ?? "").includes(needle),
    );
  }, [exercises, query]);

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="sticky top-0 border-b border-line bg-surface px-4 py-3">
        <div className="relative">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute inset-y-0 left-3 my-auto text-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, muscle or equipment"
            aria-label="Search exercises"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-ctl border border-line bg-surface-2 py-3 pl-9 pr-3 text-text placeholder:text-faint focus:border-accent-dim focus:outline-none"
          />
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Nothing matches &ldquo;{query}&rdquo;. Add it as a custom exercise in Plan.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {matches.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(exercise);
                  setQuery("");
                }}
                className="flex min-h-14 w-full flex-col items-start justify-center gap-0.5 px-4 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-surface-2"
              >
                <span className="text-sm font-medium text-text">{exercise.name}</span>
                <span className="text-xs text-faint">
                  {exercise.primary_muscle}
                  {exercise.equipment ? ` | ${exercise.equipment}` : ""}
                  {exercise.owner_id ? " | yours" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
