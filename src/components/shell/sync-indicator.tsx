"use client";

import { CloudSlash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useSession } from "@/components/providers/session-provider";

/**
 * Says something only when there is something to say.
 *
 * Silent in the normal case, including offline with nothing queued, because a
 * permanent "offline" chip trains people to ignore the one time it matters.
 * It appears when work is actually waiting, and changes tone when the queue
 * has started failing for a reason other than the network.
 */
export function SyncIndicator() {
  const { online, sync } = useSession();

  const waiting = sync.pending > 0 && !online;
  const failing = sync.pending > 0 && online && sync.stalled;

  if (!waiting && !failing) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-line bg-surface-2 px-4 py-1.5 text-xs"
    >
      {failing ? (
        <>
          <WarningCircle size={14} weight="fill" className="shrink-0 text-danger" />
          <span className="text-muted">
            <span className="tnum text-text">{sync.pending}</span> change
            {sync.pending === 1 ? "" : "s"} could not sync. They are saved on this phone.
          </span>
        </>
      ) : (
        <>
          <CloudSlash size={14} weight="fill" className="shrink-0 text-muted" />
          <span className="text-muted">
            Offline. <span className="tnum text-text">{sync.pending}</span> change
            {sync.pending === 1 ? "" : "s"} will sync.
          </span>
        </>
      )}
    </div>
  );
}
