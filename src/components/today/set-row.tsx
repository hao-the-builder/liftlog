"use client";

import clsx from "clsx";
import { Check, Trophy } from "@phosphor-icons/react/dist/ssr";
import { NumberStepper } from "@/components/ui/number-stepper";
import { prLabel, type PrKind } from "@/lib/logic/prs";
import type { Unit } from "@/lib/types/database";

export interface SetRowProps {
  index: number;
  logged: boolean;
  weight: number;
  reps: number;
  increment: number;
  unit: Unit;
  isWarmup: boolean;
  isDropSet: boolean;
  pr: PrKind | null;
  onWeight: (value: number) => void;
  onReps: (value: number) => void;
  onToggleLogged: () => void;
  /** Cycles normal, warm-up, drop set. */
  onCycleType: () => void;
}

/**
 * One set.
 *
 * Reads left to right the way the lifter thinks: which set, how much, how
 * many, done. The check sits on the right edge because that is where the
 * thumb already is, and it is the largest target in the row.
 */
export function SetRow({
  index,
  logged,
  weight,
  reps,
  increment,
  unit,
  isWarmup,
  isDropSet,
  pr,
  onWeight,
  onReps,
  onToggleLogged,
  onCycleType,
}: SetRowProps) {
  const type = isWarmup ? "warm-up" : isDropSet ? "drop set" : "working set";
  return (
    <div
      className={clsx(
        "relative flex items-center gap-1 py-3 pl-2 pr-1.5 transition-colors duration-200 ease-out",
        logged && "bg-volt-deep/20",
      )}
    >
      {/* A logged set is marked by a volt edge rather than a filled row, so a
          screen of completed work stays readable instead of glowing. */}
      <span
        aria-hidden="true"
        className={clsx(
          "absolute inset-y-0 left-0 w-0.5 transition-colors duration-200 ease-out",
          logged ? (pr ? "bg-pr" : "bg-volt") : "bg-transparent",
        )}
      />

      {/* The set number doubles as the set-type control: tap to cycle through
          working set, warm-up and drop set. It keeps the row to one control
          per job and puts the rarely-used option out of the way of the check. */}
      <button
        type="button"
        onClick={onCycleType}
        aria-label={`Set ${index + 1}, ${type}. Change type.`}
        className="flex min-h-11 w-8 shrink-0 flex-col items-center justify-center rounded-ctl transition-colors duration-150 ease-out hover:bg-surface-2"
      >
        <span className={clsx("tnum text-sm font-semibold", logged ? "text-text" : "text-faint")}>
          {index + 1}
        </span>
        {(isWarmup || isDropSet) && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-faint">
            {isWarmup ? "Warm" : "Drop"}
          </span>
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-start justify-between gap-0.5">
        <NumberStepper
          label={unit}
          value={weight}
          step={increment}
          precision={2}
          onChange={onWeight}
        />
        <NumberStepper
          label="reps"
          value={reps}
          step={1}
          precision={0}
          width="narrow"
          onChange={onReps}
        />
      </div>

      {/* Straddles the row's top edge rather than sitting beside the check,
          where it covered the rep count on a narrow phone. */}
      {pr && logged && <PrBadge kind={pr} />}

      <div className="relative flex shrink-0 items-center">
        <button
          type="button"
          aria-label={logged ? `Undo set ${index + 1}` : `Log set ${index + 1}`}
          aria-pressed={logged}
          onClick={onToggleLogged}
          className={clsx(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border",
            "transition-[transform,background-color,border-color,color] duration-150 ease-out",
            "active:scale-[0.92]",
            logged
              ? pr
                ? "border-pr bg-pr text-bg glow-pr"
                : "border-volt bg-volt text-bg glow-volt"
              : "border-line-strong bg-surface-2 text-faint hover:border-volt-dim hover:text-volt",
          )}
        >
          <Check
            size={22}
            weight="bold"
            className={logged ? "animate-check-settle" : undefined}
          />
        </button>
      </div>
    </div>
  );
}

/**
 * The one celebratory moment in the app. Magenta appears here and nowhere
 * else, which is what makes it mean something.
 */
function PrBadge({ kind }: { kind: PrKind }) {
  return (
    <span className="pointer-events-none absolute right-2 top-0 z-10 flex -translate-y-1/2 items-center">
      <span
        aria-hidden="true"
        className="animate-pr-bloom absolute inset-0 rounded-full bg-pr"
      />
      <span className="animate-pr-pop relative flex items-center gap-1 rounded-ctl bg-pr-deep px-2 py-1">
        <Trophy size={12} weight="fill" className="text-pr" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-pr">
          {prLabel(kind)}
        </span>
      </span>
    </span>
  );
}
