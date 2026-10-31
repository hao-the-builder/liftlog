"use client";

import clsx from "clsx";

interface SegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A segmented control, used for units and for chart ranges.
 *
 * Built on real radio inputs so it is keyboard and screen-reader navigable
 * without reinventing anything, and styled as one pill-free bar to match the
 * rest of the control vocabulary.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      {label && (
        <span className="font-mono text-label font-light uppercase text-muted">{label}</span>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-ctl border border-line bg-surface-2 p-1"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={clsx(
                "min-h-9 rounded-[4px] px-3 text-sm font-medium",
                "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]",
                selected ? "bg-accent text-bg" : "text-muted hover:text-text",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
