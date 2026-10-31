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
  // A white pill on the void, at 19.63:1. In a design with no accent hue, the
  // primary action is the brightest object on the screen, and it carries the
  // softest of the three allowed blooms because a white pill on near-black
  // blooms a little just by being white. Never more than one of these in view.
  primary:
    "bg-accent text-bg font-medium emit-soft hover:bg-white disabled:bg-surface-3 disabled:text-faint disabled:shadow-none",
  // A wash and a brighter hairline. Secondary actions are planes, not fills.
  secondary:
    "bg-surface-2 text-text border border-line-strong hover:bg-surface-3 disabled:text-faint",
  ghost: "text-muted hover:text-text disabled:text-faint",
  // Solid, not tinted, with a white label at 6.35:1. This variant only ever
  // appears on the confirm step of something irreversible, and a destructive
  // action that looks like every other button is how people delete things they
  // meant to keep. It keeps a bloom of its own so that it belongs to the same
  // physics as the rest of the design instead of reading as a web button.
  danger:
    "bg-danger text-white font-medium emit-danger hover:bg-danger-dim disabled:bg-surface-3 disabled:text-faint disabled:shadow-none",
};

const SIZES: Record<Size, string> = {
  // Never below 44px: that is the floor for a thumb, and this app is used
  // one-handed with a bar still in the other.
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-13 px-6 text-base",
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
        // Pills. Vector's controls are either a hairline channel or a capsule,
        // and an action is a capsule.
        "inline-flex items-center justify-center gap-2 rounded-full",
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
