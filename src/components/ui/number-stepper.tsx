"use client";

import clsx from "clsx";
import { Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

interface NumberStepperProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  /** Decimal places to show. Reps use 0, weight uses whatever the step needs. */
  precision?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * The control the whole app is built around.
 *
 * Two 44px targets either side of a number big enough to read at arm's
 * length, and the number itself is a real input, so tapping it opens the
 * numeric keypad instead of making you press plus eleven times. Monospaced
 * digits mean the layout does not twitch as the value changes.
 */
export function NumberStepper({
  label,
  value,
  step,
  min = 0,
  max,
  precision = 1,
  suffix,
  disabled = false,
  onChange,
}: NumberStepperProps) {
  // A local string so a half-typed "6." or "" is allowed while editing. It is
  // tagged with the value it was typed against, so when the value changes from
  // outside (a stepper tap, a prefill arriving) the draft falls away on its own
  // rather than needing an effect to clear it.
  const [draft, setDraft] = useState<{ against: number; text: string } | null>(null);

  const display = draft && draft.against === value ? draft.text : format(value, precision);

  const clamp = (next: number) => {
    const lower = Math.max(min, next);
    return max === undefined ? lower : Math.min(max, lower);
  };

  // Snap to the step grid so repeated taps cannot drift to 62.49999.
  const bump = (direction: 1 | -1) => {
    const raw = value + direction * step;
    const snapped = Math.round(raw / step) * step;
    onChange(clamp(Number(snapped.toFixed(4))));
  };

  const commit = (text: string) => {
    const parsed = Number(text);
    setDraft(null);
    if (text.trim() === "" || !Number.isFinite(parsed)) return;
    onChange(clamp(parsed));
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-label font-medium uppercase tracking-wide text-faint">{label}</span>
      <div className="flex items-center gap-1">
        <StepButton label={`Decrease ${label}`} disabled={disabled || value <= min} onClick={() => bump(-1)}>
          <Minus size={16} weight="bold" />
        </StepButton>

        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            // No spinner arrows, no scroll-to-change, and the numeric keypad
            // on both platforms. type="number" gets none of that right.
            aria-label={label}
            disabled={disabled}
            value={display}
            onChange={(e) =>
              setDraft({ against: value, text: e.target.value.replace(/[^0-9.]/g, "") })
            }
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={clsx(
              "tnum w-[4.5ch] rounded-ctl bg-transparent px-1 py-0.5 text-center",
              "text-readout font-bold text-text",
              "border border-transparent transition-colors duration-150 ease-out",
              "focus:border-line-strong focus:bg-surface-2 focus:outline-none",
              disabled && "text-faint",
            )}
          />
        </div>

        <StepButton
          label={`Increase ${label}`}
          disabled={disabled || (max !== undefined && value >= max)}
          onClick={() => bump(1)}
        >
          <Plus size={16} weight="bold" />
        </StepButton>
      </div>
      {suffix && <span className="text-[11px] text-faint">{suffix}</span>}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex h-11 w-9 items-center justify-center rounded-ctl",
        "border border-line bg-surface-2 text-muted",
        "transition-[transform,color,border-color] duration-150 ease-out",
        "active:scale-[0.94] hover:border-line-strong hover:text-text",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function format(value: number, precision: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(precision).replace(/\.0+$/, "");
}
