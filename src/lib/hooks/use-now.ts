"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, as a value React is allowed to read during render.
 *
 * Reading Date.now() in a component body is impure, and on a statically
 * prerendered page it is worse than that: the server would bake in the build
 * time and the client would hydrate to something else. useSyncExternalStore
 * solves both, with a server snapshot of 0 that callers render as a blank.
 *
 * The snapshot is quantised to the tick interval so it is stable between
 * ticks, which is what lets React cache it instead of looping.
 */
export function useNow(intervalMs: number): number {
  return useSyncExternalStore(
    (onChange) => {
      const id = window.setInterval(onChange, intervalMs);
      return () => window.clearInterval(id);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}

const noopSubscribe = () => () => {};

/**
 * A value that only exists in the browser, such as a formatted local date.
 * Renders `serverValue` during prerender and hydration, then the real thing.
 */
export function useClientValue<T>(compute: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, compute, () => serverValue);
}
