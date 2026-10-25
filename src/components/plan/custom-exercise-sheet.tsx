"use client";

import { useState } from "react";
import clsx from "clsx";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createCustomExercise } from "@/lib/db/repo";
import { EQUIPMENT, MUSCLES } from "@/lib/muscles";
import type { ExerciseRow } from "@/lib/types/database";

interface Props {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onCreated: (exercise: ExerciseRow) => void;
}

/**
 * Creating an exercise the shared library does not have.
 *
 * Muscles are picked from the fixed vocabulary rather than typed, because
 * the volume chart groups on exact strings: a free-text "Chest" would quietly
 * become a bucket of its own.
 */
export function CustomExerciseSheet({ open, ownerId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<string>("machine");
  const [primary, setPrimary] = useState<string>("chest");
  const [secondary, setSecondary] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setEquipment("machine");
    setPrimary("chest");
    setSecondary([]);
    setError(null);
  };

  const save = async () => {
    if (!name.trim()) {
      setError("Give it a name.");
      return;
    }
    setBusy(true);
    try {
      const created = await createCustomExercise({
        ownerId,
        name,
        equipment,
        primaryMuscle: primary,
        // A muscle cannot be both the target and a helper.
        secondaryMuscles: secondary.filter((m) => m !== primary),
      });
      onCreated(created);
      reset();
      onClose();
    } catch {
      setError("You already have an exercise with that name.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      title="New exercise"
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <Button variant="primary" size="lg" block disabled={busy} onClick={() => void save()}>
          {busy ? "Saving" : "Save exercise"}
        </Button>
      }
    >
      <div className="flex flex-col gap-6 px-4 py-5">
        <Field
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Smith machine incline press"
          enterKeyHint="done"
        />

        <ChipGroup
          label="Equipment"
          options={[...EQUIPMENT]}
          selected={[equipment]}
          onToggle={setEquipment}
        />

        <ChipGroup
          label="Primary muscle"
          options={[...MUSCLES]}
          selected={[primary]}
          onToggle={(value) => {
            setPrimary(value);
            setSecondary((current) => current.filter((m) => m !== value));
          }}
        />

        <ChipGroup
          label="Secondary muscles"
          helper="Each one counts as half a set toward weekly volume."
          options={MUSCLES.filter((m) => m !== primary)}
          selected={secondary}
          onToggle={(value) =>
            setSecondary((current) =>
              current.includes(value) ? current.filter((m) => m !== value) : [...current, value],
            )
          }
        />

        {error && (
          <p role="alert" className="rounded-ctl bg-danger-deep px-3.5 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function ChipGroup({
  label,
  helper,
  options,
  selected,
  onToggle,
}: {
  label: string;
  helper?: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-medium uppercase tracking-wide text-muted">{label}</span>
      {helper && <span className="-mt-1 text-xs text-faint">{helper}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option)}
              className={clsx(
                "min-h-9 rounded-ctl border px-3 text-xs font-medium",
                "transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                active
                  ? "border-volt bg-volt-deep text-volt"
                  : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-text",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
