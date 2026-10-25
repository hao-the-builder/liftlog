"use client";

import { useSyncExternalStore } from "react";

/**
 * Reading browser-only state during render, without lying to the server.
 *
 * Two problems these solve. Reading Date.now() or navigator in a component
 * body is impure, and on a statically prerendered page it is worse than
 * that: the server would bake in the build-time value and the client would
 * hydrate to something else.
 *
 * Each hook therefore renders a server snapshot during prerender and
 * hydration, then the real value. Every subscribe here fires once on the
 * next tick, which is the part that is easy to get wrong: a store that never
 * notifies leaves the component showing the server snapshot forever, because
 * nothing ever asks it to render again.
 */

function subscribeOnce(onStoreChange: () => void): () => void {
  const id = setTimeout(onStoreChange, 0);
  return () => clearTimeout(id);
}

/**
 * The current time, quantised to the tick interval so the snapshot is stable
 * between ticks (React requires that; an always-fresh value would loop).
 * Returns 0 during prerender and hydration.
 */
export function useNow(intervalMs: number): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      // Once immediately, so the first real value lands now rather than one
      // whole interval from now, then on the interval.
      const initial = setTimeout(onStoreChange, 0);
      const repeating = setInterval(onStoreChange, intervalMs);
      return () => {
        clearTimeout(initial);
        clearInterval(repeating);
      };
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}

/**
 * A value that only exists in the browser, such as a formatted local date or
 * a capability check. `compute` must return a primitive, or the same
 * reference each call, or React will re-render forever.
 */
export function useClientValue<T>(compute: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeOnce, compute, () => serverValue);
}

const alwaysTrue = () => true;
const alwaysFalse = () => false;

/**
 * True once React has hydrated this tree.
 *
 * Used to keep credential forms unsubmittable until their handlers exist.
 * Without it, a fast tap on a slow connection submits the form natively,
 * which navigates to the same page with the email and password appended as
 * query parameters: in the address bar, in history, and in any access log
 * along the way. Disabling the submit button also blocks implicit submission
 * from the Enter key, since the default button is disabled.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeOnce, alwaysTrue, alwaysFalse);
}
