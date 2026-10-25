"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Deliberately after load rather than during it: registration competes with
 * the first render for bandwidth, and the worker is for the second visit,
 * not this one. Dev is skipped so a stale cache never masks an edit.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration fails on an insecure origin and in some private modes.
        // The app works without it; it just will not open offline.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
