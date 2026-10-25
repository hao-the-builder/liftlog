"use client";

import clsx from "clsx";
import { CaretDown, CaretUp } from "@phosphor-icons/react/dist/ssr";

interface Props {
  index: number;
  total: number;
  /** Named in the button label so a screen reader says what is moving. */
  label: string;
  onMove: (direction: -1 | 1) => void;
}

/**
 * Reordering with two buttons rather than drag and drop.
 *
 * Drag is the obvious choice on a desktop list and the wrong one here: this
 * is a one-handed screen inside a scrolling container, where a long press
 * that was meant to scroll becomes a drag. Two taps always do what they say,
 * and they work from a keyboard and a screen reader for free.
 */
export function ReorderButtons({ index, total, label, onMove }: Props) {
  return (
    <div className="flex flex-col">
      <Arrow
        label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
        direction="up"
      />
      <Arrow
        label={`Move ${label} down`}
        disabled={index >= total - 1}
        onClick={() => onMove(1)}
        direction="down"
      />
    </div>
  );
}

function Arrow({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: "up" | "down";
}) {
  const Icon = direction === "up" ? CaretUp : CaretDown;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex h-8 w-9 items-center justify-center rounded-ctl text-faint",
        "transition-[color,background-color] duration-150 ease-out",
        "hover:bg-surface-2 hover:text-text active:scale-[0.94]",
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      <Icon size={14} weight="bold" />
    </button>
  );
}
