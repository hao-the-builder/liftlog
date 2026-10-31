"use client";

import { useState } from "react";
import { CaretDown, Trash } from "@phosphor-icons/react/dist/ssr";
import clsx from "clsx";
import { ReorderButtons } from "./reorder-buttons";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { localPut } from "@/lib/db/outbox";
import type { TemplateExerciseRow, Unit } from "@/lib/types/database";

interface Props {
  row: TemplateExerciseRow;
  index: number;
  total: number;
  exerciseName: string;
  unit: Unit;
  defaultIncrement: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * One exercise in a day.
 *
 * Collapsed it shows the prescription in one line; expanded it exposes every
 * number, including the weight step and the starting weight, both of which
 * are per exercise because a cable stack and a plate-loaded leg press do not
 * move in the same jumps or start at the same load.
 */
export function PlanExerciseRow({
  row,
  index,
  total,
  exerciseName,
  unit,
  defaultIncrement,
  onMove,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const patch = (changes: Partial<TemplateExerciseRow>) =>
    void localPut("template_exercises", { ...row, ...changes } as never);

  return (
    <section className="rounded-surface bg-surface">
      <div className="flex items-center gap-1 pl-1 pr-2">
        <ReorderButtons index={index} total={total} label={exerciseName} onMove={onMove} />

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-16 flex-1 items-center justify-between gap-3 py-3 text-left"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{exerciseName}</p>
            <p className="mt-0.5 text-xs text-muted">
              <span className="tnum">{row.sets}</span> x{" "}
              <span className="tnum">
                {row.rep_min}-{row.rep_max}
              </span>{" "}
              <span className="text-faint">|</span> <span className="tnum">{row.rest_seconds}</span>s
              rest <span className="text-faint">|</span> +
              <span className="tnum">{row.increment ?? defaultIncrement}</span> {unit}
              {row.start_weight !== null && (
                <>
                  {" "}
                  <span className="text-faint">|</span> from{" "}
                  <span className="tnum">{row.start_weight}</span> {unit}
                </>
              )}
            </p>
          </div>
          <CaretDown
            size={16}
            className={clsx(
              "shrink-0 text-faint transition-transform duration-200 ease-out",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <SmallNumber
              label="Sets"
              value={row.sets}
              min={1}
              max={20}
              onChange={(sets) => patch({ sets })}
            />
            <SmallNumber
              label={`Rest (s)`}
              value={row.rest_seconds}
              min={0}
              max={1800}
              step={15}
              onChange={(rest_seconds) => patch({ rest_seconds })}
            />
            <SmallNumber
              label="Min reps"
              value={row.rep_min}
              min={1}
              max={100}
              onChange={(rep_min) => patch({ rep_min, rep_max: Math.max(rep_min, row.rep_max) })}
            />
            <SmallNumber
              label="Max reps"
              value={row.rep_max}
              min={1}
              max={100}
              onChange={(rep_max) => patch({ rep_max, rep_min: Math.min(rep_max, row.rep_min) })}
            />
          </div>

          <OptionalNumber
            label={`Starting weight (${unit})`}
            value={row.start_weight}
            min={0}
            step={row.increment ?? defaultIncrement}
            helper={
              row.start_weight === null
                ? "Blank opens the first set at 0. Set it once and every new set starts here until you have history."
                : "Only seeds a set you have not logged. Last session always wins."
            }
            onChange={(start_weight) => patch({ start_weight })}
          />

          <SmallNumber
            label={`Weight step (${unit})`}
            value={row.increment ?? defaultIncrement}
            min={0.25}
            step={0.25}
            decimal
            helper={
              row.increment === null
                ? `Using your default of ${defaultIncrement} ${unit}.`
                : "Set for this exercise only."
            }
            onChange={(increment) => patch({ increment })}
          />

          <label className="flex flex-col gap-2">
            <span className="text-label font-medium uppercase tracking-wide text-muted">Note</span>
            <input
              value={row.notes ?? ""}
              onChange={(e) => patch({ notes: e.target.value || null })}
              placeholder="Pain-free depth only"
              className="w-full rounded-ctl border border-line bg-surface-2 px-3.5 py-3 text-text placeholder:text-faint focus:border-volt-dim focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="flex min-h-11 items-center gap-2 text-sm text-muted transition-colors duration-150 ease-out hover:text-danger"
          >
            <Trash size={15} />
            Remove from this day
          </button>
        </div>
      )}

      <Sheet
        open={confirmRemove}
        title={`Remove ${exerciseName}?`}
        onClose={() => setConfirmRemove(false)}
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              size="lg"
              block
              onClick={() => {
                setConfirmRemove(false);
                onRemove();
              }}
            >
              Remove from this day
            </Button>
            <Button size="lg" block onClick={() => setConfirmRemove(false)}>
              Keep it
            </Button>
          </div>
        }
      >
        <p className="px-4 py-5 text-sm text-muted">
          It comes out of this day along with its sets, reps and starting weight. The exercise
          stays in your library, and sets you already logged against it stay in your history.
        </p>
      </Sheet>
    </section>
  );
}

/**
 * A number that is allowed to be absent.
 *
 * Clearing the field means null, which is a real answer here and not an
 * error: "I have no starting weight for this" is different from "the starting
 * weight is zero", and only one of them should put a 0 on the screen.
 */
function OptionalNumber({
  label,
  value,
  min,
  step,
  helper,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  step: number;
  helper?: string;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    setDraft(null);
    const trimmed = text.trim();
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.max(min, parsed));
  };

  return (
    <label className="flex flex-col gap-2">
      <span className="text-label font-medium uppercase tracking-wide text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? (value === null ? "" : String(value))}
        step={step}
        placeholder="Not set"
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="tnum w-full rounded-ctl border border-line bg-surface-2 px-3.5 py-3 text-text placeholder:text-faint focus:border-volt-dim focus:outline-none"
      />
      {helper && <span className="text-xs text-faint">{helper}</span>}
    </label>
  );
}

function SmallNumber({
  label,
  value,
  min,
  max,
  step = 1,
  decimal = false,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  decimal?: boolean;
  helper?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    const parsed = Number(text);
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, parsed));
    onChange(decimal ? clamped : Math.round(clamped));
  };

  return (
    <label className="flex flex-col gap-2">
      <span className="text-label font-medium uppercase tracking-wide text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? String(value)}
        step={step}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="tnum w-full rounded-ctl border border-line bg-surface-2 px-3.5 py-3 text-text focus:border-volt-dim focus:outline-none"
      />
      {helper && <span className="text-xs text-faint">{helper}</span>}
    </label>
  );
}
