"use client";

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowsDownUp, Lightning, Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import { SetRow } from "./set-row";
import { db } from "@/lib/db/schema";
import { localDelete } from "@/lib/db/outbox";
import { allSetsForExercise, lastSessionSets, logSet, updateSet } from "@/lib/db/repo";
import { detectPrs, primaryPr, summarisePrs, type PrKind } from "@/lib/logic/prs";
import { progressionHint } from "@/lib/logic/progression";
import type { SetLogRow, Unit } from "@/lib/types/database";

export interface PlannedExercise {
  /** Stable per row of the plan, so the same exercise twice in a day works. */
  key: string;
  exerciseId: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  increment: number;
  /** Seeds the first session, before there is a last session to copy. */
  startWeight: number | null;
  notes: string | null;
}

interface DraftSet {
  weight: number;
  reps: number;
  isWarmup: boolean;
  isDropSet: boolean;
}

interface Props {
  workoutId: string;
  userId: string;
  unit: Unit;
  plan: PlannedExercise;
  onLogged: (restSeconds: number, exerciseName: string) => void;
  onSwap?: (plan: PlannedExercise) => void;
  onPr?: (entry: { exercise: string; kind: PrKind; weight: number; reps: number }) => void;
}

export function ExerciseBlock({ workoutId, userId, unit, plan, onLogged, onSwap, onPr }: Props) {
  const [drafts, setDrafts] = useState<Record<number, DraftSet>>({});
  const [extraSets, setExtraSets] = useState(0);
  const [flashedPrs, setFlashedPrs] = useState<Record<string, PrKind>>({});

  const logged = useLiveQuery(
    () =>
      db()
        .setLogs.where("[workout_id+exercise_id]")
        .equals([workoutId, plan.exerciseId])
        .toArray(),
    [workoutId, plan.exerciseId],
  );

  const last = useLiveQuery(
    () => lastSessionSets(plan.exerciseId, workoutId),
    [plan.exerciseId, workoutId],
  );

  const loggedByIndex = useMemo(() => {
    const map = new Map<number, SetLogRow>();
    for (const row of logged ?? []) map.set(row.set_index, row);
    return map;
  }, [logged]);

  const rowCount = Math.max(
    plan.targetSets + extraSets,
    (logged?.length ?? 0) > 0 ? Math.max(...(logged ?? []).map((r) => r.set_index)) + 1 : 0,
    1,
  );

  const hint = useMemo(
    () =>
      progressionHint({
        lastSession: (last?.sets ?? []).map((s) => ({
          weight: s.weight,
          reps: s.reps,
          isWarmup: s.is_warmup,
        })),
        repMin: plan.repMin,
        repMax: plan.repMax,
        increment: plan.increment,
        unit,
      }),
    [last, plan.repMin, plan.repMax, plan.increment, unit],
  );

  /** What a not-yet-logged row shows before the user touches it. */
  const seedFor = useCallback(
    (index: number): DraftSet => {
      const previous = last?.sets ?? [];
      const match = previous[index] ?? previous[previous.length - 1];
      // History first, then the planned starting weight, then nothing. The
      // order matters: a starting weight is where the exercise began, not
      // where it should stay, so real sets always win over it.
      return {
        weight: match?.weight ?? plan.startWeight ?? 0,
        reps: match?.reps ?? plan.repMax,
        isWarmup: false,
        isDropSet: false,
      };
    },
    [last, plan.repMax, plan.startWeight],
  );

  const valueFor = (index: number): DraftSet => {
    const row = loggedByIndex.get(index);
    if (row) {
      return {
        weight: row.weight,
        reps: row.reps,
        isWarmup: row.is_warmup,
        isDropSet: row.is_drop_set,
      };
    }
    return drafts[index] ?? seedFor(index);
  };

  const patchDraft = (index: number, patch: Partial<DraftSet>) => {
    setDrafts((current) => ({ ...current, [index]: { ...valueFor(index), ...patch } }));
  };

  const editField = async (index: number, patch: Partial<DraftSet>) => {
    const row = loggedByIndex.get(index);
    if (!row) {
      patchDraft(index, patch);
      return;
    }
    // Editing an already-logged set corrects it in place rather than
    // creating a second row, so the history stays honest.
    const next = { ...valueFor(index), ...patch };
    await updateSet({
      ...row,
      weight: next.weight,
      reps: next.reps,
      is_warmup: next.isWarmup,
      is_drop_set: next.isDropSet,
    });
  };

  const toggleLogged = async (index: number) => {
    const existing = loggedByIndex.get(index);

    if (existing) {
      setFlashedPrs((current) => {
        const next = { ...current };
        delete next[existing.id];
        return next;
      });
      await localDelete("set_logs", existing.id);
      return;
    }

    const value = valueFor(index);

    // Records are judged against everything logged for this exercise so far,
    // including earlier sets in this same session.
    const history = await allSetsForExercise(plan.exerciseId);
    const prior = summarisePrs(
      history.map((s) => ({ weight: s.weight, reps: s.reps, isWarmup: s.is_warmup })),
    );
    const kind = primaryPr(
      detectPrs({ weight: value.weight, reps: value.reps, isWarmup: value.isWarmup }, prior),
    );

    const row = await logSet({
      userId,
      workoutId,
      exerciseId: plan.exerciseId,
      setIndex: index,
      weight: value.weight,
      reps: value.reps,
      isWarmup: value.isWarmup,
      isDropSet: value.isDropSet,
    });

    if (kind) {
      setFlashedPrs((current) => ({ ...current, [row.id]: kind }));
      onPr?.({ exercise: plan.name, kind, weight: value.weight, reps: value.reps });
    }

    // Warm-ups do not start a rest timer; nobody rests 150 seconds after a
    // 20 kg warm-up, and an unwanted timer is worse than no timer.
    if (!value.isWarmup) onLogged(plan.restSeconds, plan.name);
  };

  const cycleType = (index: number) => {
    const value = valueFor(index);
    const next = value.isWarmup
      ? { isWarmup: false, isDropSet: true }
      : value.isDropSet
        ? { isWarmup: false, isDropSet: false }
        : { isWarmup: true, isDropSet: false };
    void editField(index, next);
  };

  const doneCount = logged?.length ?? 0;

  return (
    <section className="pane rounded-surface">
      <header className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium leading-tight text-text">{plan.name}</h2>
          <p className="mt-1 text-xs text-muted">
            <span className="tnum">{plan.targetSets}</span> x{" "}
            <span className="tnum">
              {plan.repMin}-{plan.repMax}
            </span>{" "}
            <span className="text-faint">|</span> rest{" "}
            <span className="tnum">{plan.restSeconds}</span>s
          </p>
        </div>
        <span className="tnum shrink-0 text-xs text-faint">
          {doneCount}/{rowCount}
        </span>
        {onSwap && (
          <button
            type="button"
            onClick={() => onSwap(plan)}
            aria-label={`Swap ${plan.name} for another exercise`}
            className="-mt-1 flex h-9 w-9 items-center justify-center rounded-ctl text-faint transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text"
          >
            <ArrowsDownUp size={16} />
          </button>
        )}
      </header>

      <div className="space-y-1.5 px-4 pb-3">
        {last && last.sets.length > 0 && (
          <p className="text-xs text-muted">{describeLastSession(last.sets, unit)}</p>
        )}
        <p className="flex items-start gap-1.5 text-xs text-accent-dim">
          <Lightning size={13} weight="fill" className="mt-0.5 shrink-0" />
          <span>{hint.text}</span>
        </p>
        {plan.notes && <p className="text-xs italic text-faint">{plan.notes}</p>}
      </div>

      <div className="divide-y divide-line border-t border-line">
        {Array.from({ length: rowCount }, (_, index) => {
          const value = valueFor(index);
          const row = loggedByIndex.get(index);
          return (
            <SetRow
              key={index}
              index={index}
              logged={Boolean(row)}
              weight={value.weight}
              reps={value.reps}
              increment={plan.increment}
              unit={unit}
              isWarmup={value.isWarmup}
              isDropSet={value.isDropSet}
              pr={row ? (flashedPrs[row.id] ?? null) : null}
              onWeight={(weight) => void editField(index, { weight })}
              onReps={(reps) => void editField(index, { reps })}
              onToggleLogged={() => void toggleLogged(index)}
              onCycleType={() => cycleType(index)}
            />
          );
        })}
      </div>

      <footer className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        <SmallAction onClick={() => setExtraSets((n) => n + 1)} icon={<Plus size={13} />}>
          Add set
        </SmallAction>
        <SmallAction
          onClick={() => setExtraSets((n) => Math.max(0, n - 1))}
          disabled={rowCount <= Math.max(1, doneCount) || extraSets === 0}
          icon={<Minus size={13} />}
        >
          Remove set
        </SmallAction>
      </footer>
    </section>
  );
}

function SmallAction({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex min-h-9 items-center gap-1.5 rounded-ctl px-2.5 text-xs font-medium text-muted",
        "transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text",
        "disabled:pointer-events-none disabled:text-faint disabled:opacity-50",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * "Last time 50 kg x 9, 9, 8" when the load held, and a per-set list when it
 * did not. Warm-ups are left out: they are not what you are chasing.
 */
export function describeLastSession(sets: SetLogRow[], unit: Unit): string {
  const working = sets.filter((s) => !s.is_warmup);
  if (working.length === 0) return "";

  const weights = new Set(working.map((s) => s.weight));
  if (weights.size === 1) {
    const weight = working[0].weight;
    return `Last time ${weight} ${unit} x ${working.map((s) => s.reps).join(", ")}`;
  }
  return `Last time ${working.map((s) => `${s.weight}x${s.reps}`).join(", ")} ${unit}`;
}
