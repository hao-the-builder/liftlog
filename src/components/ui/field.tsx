"use client";

import clsx from "clsx";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Always rendered. A placeholder is never a label. */
  label: string;
  helper?: ReactNode;
  error?: string | null;
  /** Unit or other trailing adornment, e.g. "kg". */
  suffix?: string;
}

export function Field({
  label,
  helper,
  error,
  suffix,
  className,
  type = "text",
  ...props
}: FieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium uppercase tracking-wide text-muted">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={clsx(helper && helperId, error && errorId) || undefined}
          className={clsx(
            "w-full rounded-ctl bg-surface-2 px-3.5 py-3 text-text",
            "border transition-colors duration-150 ease-out",
            "placeholder:text-faint",
            error ? "border-danger" : "border-line focus:border-volt-dim",
            suffix && "pr-12",
            className,
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">
            {suffix}
          </span>
        )}
      </div>

      {helper && !error && (
        <p id={helperId} className="text-xs text-muted">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
