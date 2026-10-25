"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Fills the width of its container. The default for primary actions. */
  block?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  // Volt filled, near-black label. The accent is reserved for the action the
  // screen exists for, so there is never more than one of these in view.
  primary: "bg-volt text-bg font-semibold hover:bg-volt-dim disabled:bg-surface-3 disabled:text-faint",
  secondary: "bg-surface-2 text-text border border-line hover:border-line-strong disabled:text-faint",
  ghost: "text-muted hover:text-text disabled:text-faint",
  danger: "bg-danger-deep text-danger border border-danger/40 hover:border-danger disabled:text-faint",
};

const SIZES: Record<Size, string> = {
  // Never below 44px: that is the floor for a thumb, and this app is used
  // one-handed with a bar still in the other.
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-13 px-5 text-base",
};

export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-ctl",
        // Press feedback lives on :active so touch gets it too, and it is
        // fast enough to read as the interface hearing the tap.
        "transition-[transform,background-color,border-color,color] duration-150 ease-out",
        "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-70",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}
