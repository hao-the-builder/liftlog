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
  /** Weight needs room for "122.5"; reps never exceeds three digits. */
  width?: "wide" | "narrow";
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
  width = "wide",
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
      <div className="flex items-center gap-0.5">
        <StepButton label={`Decrease ${label}`} disabled={disabled || value <= min} onClick={() => bump(-1)}>
          <Minus size={15} weight="bold" />
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
              // min-w-0 matters: an <input> carries an intrinsic width of about
              // twenty characters, so flex min-width:auto refuses to let it
              // shrink and the row runs off the side of a phone. The widths
              // below are measured to fit a 390px screen: index, two steppers
              // and a 48px check, with the weight sized for "122.5".
              "tnum min-w-0 rounded-ctl bg-transparent px-0.5 py-0.5 text-center",
              "text-[1.375rem] leading-none font-bold tracking-tight text-text",
              width === "wide" ? "w-[4.5rem]" : "w-[2.75rem]",
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
          <Plus size={15} weight="bold" />
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
        // 44px tall for the thumb, narrow so two steppers and a check fit
        // across a 390px phone without the row scrolling sideways.
        "flex h-11 w-7 shrink-0 items-center justify-center rounded-ctl",
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
  // toFixed then trim: 57.5 at precision 2 is "57.50", and the naive
  // /\.0+$/ strip leaves it alone because it ends in "50", not "0".
  return value.toFixed(precision).replace(/0+$/, "").replace(/\.$/, "");
}
