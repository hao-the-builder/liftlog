"use client";

import clsx from "clsx";
import { Pause, Play, SkipForward } from "@phosphor-icons/react/dist/ssr";
import { formatClock, useRestTimer } from "@/lib/timer/use-rest-timer";

/**
 * The running rest timer, docked above the tab bar on every screen.
 *
 * It is the one element in the app allowed to glow continuously, because it
 * is the one thing you need to read from two metres away with a bar in your
 * hands. The countdown is monospaced so the digits never shift, and the
 * remaining rest is drawn as a closing arc rather than a filling bar.
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
      // This genuinely has the app scrolling behind it, so it is one of the
      // three layers that earns a blur.
      className="pane-blur relative border-t border-line"
    >
      <div className="relative flex items-center gap-3 px-4 py-2.5">
        <RestArc progress={progress} paused={paused} nearlyDone={nearlyDone} />

        <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
          <span
            className={clsx(
              "tnum text-2xl font-medium tabular-nums",
              paused ? "text-muted" : "text-accent",
              nearlyDone && "text-emit-soft",
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
            <span className="tnum text-xs font-medium">-15</span>
          </TimerButton>
          <TimerButton label="Add 15 seconds" onClick={() => void timer.adjust(15)}>
            <span className="tnum text-xs font-medium">+15</span>
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

/**
 * The countdown as an angle.
 *
 * A rest timer is a quantity closing, not a quantity accumulating, so it is
 * drawn as an arc that empties rather than a bar that fills. The arc is also
 * readable at a glance from further away than a digit is, which matters when
 * the phone is on the floor and you are under a bar.
 */
function RestArc({
  progress,
  paused,
  nearlyDone,
}: {
  progress: number;
  paused: boolean;
  nearlyDone: boolean;
}) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const elapsed = Math.min(1, Math.max(0, progress));

  return (
    <svg
      aria-hidden="true"
      width="36"
      height="36"
      viewBox="0 0 36 36"
      className={clsx("shrink-0", nearlyDone && "animate-arc-pulse")}
    >
      {/* The track. A hairline, so the empty part of the angle is still a
          drawn thing rather than a hole. */}
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="var(--color-line-strong)"
        strokeWidth="1.5"
      />
      {/* The remaining rest. Rotated so it starts at twelve o'clock and
          closes clockwise, which is the direction a clock hand already
          taught everyone to read. */}
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke={paused ? "var(--color-muted)" : "var(--color-accent)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * elapsed}
        transform="rotate(-90 18 18)"
        style={{ transition: "stroke-dashoffset 200ms linear" }}
      />
    </svg>
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
