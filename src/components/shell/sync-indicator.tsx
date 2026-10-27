"use client";

import { useState } from "react";
import { ArrowClockwise, CloudSlash, Copy, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useSession } from "@/components/providers/session-provider";
import { useClientValue } from "@/lib/hooks/use-now";

/**
 * Says something only when there is something to say.
 *
 * Silent in the normal case, including offline with nothing queued, because a
 * permanent "offline" chip trains people to ignore the one time it matters.
 * It appears when work is actually waiting, and changes tone when the queue
 * has started failing for a reason other than the network.
 *
 * A stall is the one case worth opening up. Offline resolves itself and needs
 * no explanation; a rejected write does not, and the reason lives on the
 * phone where no console can reach it. So the failing banner is a button, and
 * behind it is the error verbatim plus the two things anyone can do about it:
 * try again, or send the details to someone who can read them.
 */
export function SyncIndicator() {
  const { online, sync } = useSession();
  const [open, setOpen] = useState(false);

  const waiting = sync.pending > 0 && !online;
  const failing = sync.pending > 0 && online && sync.stalled;

  if (!waiting && !failing) return null;

  const plural = sync.pending === 1 ? "" : "s";

  if (!failing) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 border-b border-line bg-surface-2 px-4 py-1.5 text-xs"
      >
        <CloudSlash size={14} weight="fill" className="shrink-0 text-muted" />
        <span className="text-muted">
          Offline. <span className="tnum text-text">{sync.pending}</span> change{plural} will sync.
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${sync.pending} change${plural} could not sync. Open details.`}
        className="flex w-full items-center justify-center gap-2 border-b border-line bg-surface-2 px-4 py-1.5 text-xs transition-colors duration-150 ease-out hover:bg-surface-3"
      >
        <WarningCircle size={14} weight="fill" className="shrink-0 text-danger" />
        <span className="text-muted">
          <span className="tnum text-text">{sync.pending}</span> change{plural} could not sync.{" "}
          <span className="text-text underline underline-offset-2">Details</span>
        </span>
      </button>

      <SyncProblemSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SyncProblemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sync, retrySync } = useSession();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Formatted on the client only: a locale timestamp rendered on the server
  // is a different string than the one the browser produces.
  const lastSynced = useClientValue(
    () => (sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : "Never"),
    "",
  );

  const operation = sync.headTable
    ? `${sync.headOp ?? "upsert"} ${sync.headTable}`
    : "unknown";

  const details = [
    `Liftlog sync problem`,
    `queued: ${sync.pending}`,
    `stuck on: ${operation}`,
    `attempts: ${sync.attempts}`,
    `last synced: ${lastSynced}`,
    `error: ${sync.lastError ?? "(none recorded)"}`,
  ].join("\n");

  const retry = async () => {
    setBusy(true);
    try {
      await retrySync();
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
    } catch {
      // Clipboard access can be refused. The text is on screen either way.
      setCopied(false);
    }
  };

  return (
    <Sheet
      open={open}
      title="Sync problem"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" block onClick={() => void retry()} disabled={busy}>
            <ArrowClockwise size={16} weight="bold" />
            {busy ? "Trying..." : "Try again"}
          </Button>
          <Button size="lg" block onClick={() => void copy()}>
            <Copy size={16} weight="bold" />
            {copied ? "Copied" : "Copy details"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-4 py-5">
        <p className="text-sm text-muted">
          <span className="font-semibold text-text">Nothing is lost.</span> Every change is on this
          phone and stays there until it goes up. The queue stops at the first failure instead of
          skipping past it, so your sets keep their order.
        </p>

        <dl className="divide-y divide-line overflow-hidden rounded-surface bg-surface-2">
          <Row label="Waiting" value={String(sync.pending)} mono />
          <Row label="Stuck on" value={operation} mono />
          <Row label="Attempts" value={String(sync.attempts)} mono />
          <Row label="Last synced" value={lastSynced || "--"} />
        </dl>

        <div>
          <p className="text-label font-medium uppercase tracking-wide text-faint">
            What the server said
          </p>
          <p className="mt-1.5 rounded-ctl border border-danger/30 bg-danger-deep px-3 py-2 font-mono text-xs leading-relaxed text-text">
            {sync.lastError ?? "No error recorded yet."}
          </p>
        </div>

        <p className="text-xs text-faint">
          A permission or constraint error means the database rejected the write, and retrying will
          not help on its own. Copy the details and fix the cause.
        </p>
      </div>
    </Sheet>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd
        className={
          mono
            ? "tnum truncate font-mono text-xs text-text"
            : "truncate text-xs text-text"
        }
      >
        {value}
      </dd>
    </div>
  );
}
