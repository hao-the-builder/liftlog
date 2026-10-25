"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type TimerState } from "@/lib/db/schema";
import { primeAudio, restFinishedFeedback } from "./feedback";

/**
 * The rest timer.
 *
 * Stored as an end timestamp rather than a countdown, which is the whole
 * trick: the phone can lock, the tab can be backgrounded for ten minutes, the
 * app can be killed and reopened, and the remaining time is still just
 * endsAt minus now. Nothing drifts because nothing is being counted down.
 *
 * It lives in IndexedDB rather than React state so every screen sees the same
 * timer, and so it survives a reload mid-set.
 */

const TICK_MS = 200;

export interface RestTimer {
  active: boolean;
  paused: boolean;
  secondsLeft: number;
  totalSeconds: number;
  /** 0 to 1, for the progress ring. */
  progress: number;
  exerciseName?: string;
  start: (seconds: number, exerciseName?: string) => Promise<void>;
  adjust: (deltaSeconds: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  skip: () => Promise<void>;
}

function msLeft(state: TimerState | undefined, now: number): number {
  if (!state) return 0;
  if (state.pausedWithMsLeft !== undefined) return state.pausedWithMsLeft;
  return Math.max(0, state.endsAt - now);
}

export function useRestTimer(): RestTimer {
  const state = useLiveQuery(() => db().timers.get("rest"), []);
  const [now, setNow] = useState(() => Date.now());
  const firedFor = useRef<number | null>(null);

  const paused = state?.pausedWithMsLeft !== undefined;
  const remainingMs = msLeft(state, now);
  const active = Boolean(state) && (paused || remainingMs > 0);

  // One interval for the whole app. It only runs while a timer is running, so
  // an idle app does no work.
  useEffect(() => {
    if (!state || paused) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    // Coming back from a locked screen recomputes immediately rather than
    // waiting out the first tick.
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state, paused]);

  // Fire the end-of-rest feedback exactly once per timer.
  useEffect(() => {
    if (!state || paused) return;
    if (state.endsAt - now > 0) return;
    if (firedFor.current === state.endsAt) return;
    firedFor.current = state.endsAt;
    restFinishedFeedback(state.exerciseName);
    void db().timers.delete("rest");
  }, [state, paused, now]);

  const start = useCallback(async (seconds: number, exerciseName?: string) => {
    // Called straight from the tap that logged the set, which is the only
    // moment the browser will let us wake the audio context.
    primeAudio();
    firedFor.current = null;
    await db().timers.put({
      key: "rest",
      endsAt: Date.now() + seconds * 1000,
      totalSeconds: seconds,
      exerciseName,
    });
    setNow(Date.now());
  }, []);

  const adjust = useCallback(async (deltaSeconds: number) => {
    const current = await db().timers.get("rest");
    if (!current) return;
    const delta = deltaSeconds * 1000;

    if (current.pausedWithMsLeft !== undefined) {
      await db().timers.put({
        ...current,
        pausedWithMsLeft: Math.max(0, current.pausedWithMsLeft + delta),
        totalSeconds: Math.max(1, current.totalSeconds + deltaSeconds),
      });
    } else {
      await db().timers.put({
        ...current,
        endsAt: Math.max(Date.now(), current.endsAt + delta),
        totalSeconds: Math.max(1, current.totalSeconds + deltaSeconds),
      });
    }
    firedFor.current = null;
    setNow(Date.now());
  }, []);

  const pause = useCallback(async () => {
    const current = await db().timers.get("rest");
    if (!current || current.pausedWithMsLeft !== undefined) return;
    await db().timers.put({
      ...current,
      pausedWithMsLeft: Math.max(0, current.endsAt - Date.now()),
    });
  }, []);

  const resume = useCallback(async () => {
    const current = await db().timers.get("rest");
    if (!current || current.pausedWithMsLeft === undefined) return;
    const { pausedWithMsLeft, ...rest } = current;
    await db().timers.put({ ...rest, endsAt: Date.now() + pausedWithMsLeft });
    setNow(Date.now());
  }, []);

  const skip = useCallback(async () => {
    firedFor.current = null;
    await db().timers.delete("rest");
  }, []);

  const totalSeconds = state?.totalSeconds ?? 0;
  const secondsLeft = Math.ceil(remainingMs / 1000);

  return {
    active,
    paused,
    secondsLeft,
    totalSeconds,
    progress: totalSeconds > 0 ? 1 - remainingMs / (totalSeconds * 1000) : 0,
    exerciseName: state?.exerciseName,
    start,
    adjust,
    pause,
    resume,
    skip,
  };
}

/** mm:ss, always two digits, so the width never changes mid-countdown. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
