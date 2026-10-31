"use client";

import { useState } from "react";
import { Export, X } from "@phosphor-icons/react/dist/ssr";
import { useClientValue } from "@/lib/hooks/use-now";

const DISMISS_KEY = "liftlog:install-hint-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari predates the standard and still reports it here.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
  // Chrome and Firefox on iOS cannot add to the home screen, so the hint
  // would be telling the user to do something they cannot do.
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && safari;
}

function alreadyDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Private mode. Treat it as not dismissed; showing the hint once more is
    // better than crashing on a storage read.
    return false;
  }
}

/**
 * The one-time iOS "Add to Home Screen" hint.
 *
 * iOS has no install prompt and no beforeinstallprompt event, so the only way
 * to get Liftlog onto a home screen is for the user to know about Share, Add
 * to Home Screen. This says that once and then never again.
 *
 * It is not shown when the app is already installed, and not on browsers that
 * cannot install at all.
 */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(false);

  // Computed in the browser only: during prerender there is no navigator, and
  // this page is part of a static shell.
  const eligible = useClientValue(
    () => isIosSafari() && !isStandalone() && !alreadyDismissed(),
    false,
  );

  if (!eligible || dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to do; it will show once more next time.
    }
    setDismissed(true);
  };

  return (
    <div
      role="note"
      className="flex items-start gap-3 border-b border-line bg-surface-2 px-4 py-3"
    >
      <Export size={18} weight="bold" className="mt-0.5 shrink-0 text-accent" />
      <p className="flex-1 text-xs leading-relaxed text-muted">
        <span className="font-medium text-text">Put Liftlog on your home screen.</span> Tap
        Share, then Add to Home Screen. It opens full screen and works without signal.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl text-faint transition-colors duration-150 ease-out hover:bg-surface-3 hover:text-text"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
