"use client";

import clsx from "clsx";
import { Pause, Play, SkipForward } from "@phosphor-icons/react/dist/ssr";
import { formatClock, useRestTimer } from "@/lib/timer/use-rest-timer";

/**
 * The running rest timer, docked above the tab bar on every screen.
 *
 * It is the one element in the app allowed to glow continuously, because it
 * is the one thing you need to read from two metres away with a bar in your
 * hands. The countdown is monospaced so the digits never shift.
 */
export function RestTimerBar() {
  const timer = useRestTimer();
  if (!timer.active) return null;

  const { secondsLeft, progress, paused, exerciseName } = timer;
  const nearlyDone = secondsLeft <= 10 && !paused;

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Rest, ${formatClock(secondsLeft)} remaining`}
      className="relative overflow-hidden border-t border-line bg-surface"
    >
      {/* Progress fills left to right as the rest elapses. Width, not
          transform, because the bar is the measurement. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-volt-deep transition-[width] duration-200 ease-linear"
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
      />

      <div className="relative flex items-center gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
          <span
            className={clsx(
              "tnum text-2xl font-bold tabular-nums",
              paused ? "text-muted" : "text-volt",
              nearlyDone && "text-glow-volt",
            )}
          >
            {formatClock(secondsLeft)}
          </span>
          <span className="truncate text-xs text-muted">
            {paused ? "Paused" : (exerciseName ?? "Rest")}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <TimerButton label="Take 15 seconds off" onClick={() => void timer.adjust(-15)}>
            <span className="tnum text-xs font-semibold">-15</span>
          </TimerButton>
          <TimerButton label="Add 15 seconds" onClick={() => void timer.adjust(15)}>
            <span className="tnum text-xs font-semibold">+15</span>
          </TimerButton>
          <TimerButton
            label={paused ? "Resume rest" : "Pause rest"}
            onClick={() => void (paused ? timer.resume() : timer.pause())}
          >
            {paused ? <Play size={16} weight="fill" /> : <Pause size={16} weight="fill" />}
          </TimerButton>
          <TimerButton label="Skip rest" onClick={() => void timer.skip()}>
            <SkipForward size={16} weight="fill" />
          </TimerButton>
        </div>
      </div>
    </div>
  );
}

function TimerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "flex h-11 w-11 items-center justify-center rounded-ctl text-muted",
        "transition-[transform,color,background-color] duration-150 ease-out",
        "active:scale-[0.94] hover:bg-surface-2 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
