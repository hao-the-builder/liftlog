"use client";

import { useState } from "react";
import Link from "next/link";
import { BellSimple, CaretLeft, DownloadSimple, SignOut, Trash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { useSession } from "@/components/providers/session-provider";
import { saveProfile, toLocalDateString } from "@/lib/db/repo";
import { buildExportZip, downloadZip } from "@/lib/export/build-export";
import { requestNotificationPermission } from "@/lib/timer/feedback";
import { clearLocalDatabase } from "@/lib/db/schema";
import type { Unit } from "@/lib/types/database";

export default function SettingsPage() {
  const { profile, email, signOut, sync } = useSession();
  const [exporting, setExporting] = useState(false);
  const [notifications, setNotifications] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!profile) return <div className="px-4 py-6 text-sm text-muted">Loading.</div>;

  const patch = (changes: Partial<typeof profile>) => void saveProfile({ ...profile, ...changes });

  const exportAll = async () => {
    setExporting(true);
    try {
      const bytes = await buildExportZip();
      downloadZip(bytes, `liftlog-${toLocalDateString()}.zip`);
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setDeleteError(body.error ?? "Could not delete the account.");
        setDeleting(false);
        return;
      }
      await clearLocalDatabase();
      // A full reload, not a route push: the local database this tree's live
      // queries are bound to has just been deleted.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/signup");
    } catch {
      setDeleteError("Could not reach the server. Try again when you have signal.");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <header className="flex items-center gap-1 py-4">
        <Link
          href="/plan"
          aria-label="Back"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-ctl text-muted transition-colors duration-150 ease-out hover:bg-surface hover:text-text"
        >
          <CaretLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
      </header>

      <div className="space-y-6">
        <Group title="You">
          <div className="space-y-5 px-4 py-4">
            <Field
              label="Display name"
              value={profile.display_name}
              onChange={(e) => patch({ display_name: e.target.value })}
            />
            <Segmented
              label="Units"
              value={profile.unit}
              onChange={(unit: Unit) => patch({ unit })}
              options={[
                { value: "kg", label: "Kilograms" },
                { value: "lb", label: "Pounds" },
              ]}
            />
            <Field
              label="Protein target"
              type="text"
              inputMode="decimal"
              suffix={`g / ${profile.unit}`}
              defaultValue={String(profile.protein_target_g_per_kg)}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value > 0) patch({ protein_target_g_per_kg: value });
              }}
            />
            <Field
              label="Default weight step"
              type="text"
              inputMode="decimal"
              suffix={profile.unit}
              defaultValue={String(profile.default_increment)}
              helper="Used wherever an exercise has no step of its own."
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value > 0) patch({ default_increment: value });
              }}
            />
          </div>
        </Group>

        <Group title="Rest timer">
          <div className="px-4 py-4">
            <p className="text-sm text-muted">
              A notification when rest ends is useful when the phone is in your pocket. It
              needs permission once.
            </p>
            <Button
              className="mt-3"
              onClick={async () => {
                const result = await requestNotificationPermission();
                setNotifications(
                  result === "granted"
                    ? "Notifications on."
                    : result === "denied"
                      ? "Blocked. Turn it back on in your browser settings for this site."
                      : "This browser does not support notifications.",
                );
              }}
            >
              <BellSimple size={16} />
              Allow notifications
            </Button>
            {notifications && <p className="mt-2 text-xs text-muted">{notifications}</p>}
          </div>
        </Group>

        <Group title="Your data">
          <div className="space-y-4 px-4 py-4">
            <div>
              <p className="text-sm text-muted">
                Every set, workout, weigh-in and plan, as CSV files in one archive. Built
                from the copy on this phone, so it works offline.
              </p>
              <Button className="mt-3" disabled={exporting} onClick={() => void exportAll()}>
                <DownloadSimple size={16} />
                {exporting ? "Preparing" : "Export everything"}
              </Button>
            </div>

            {sync.pending > 0 && (
              <p className="text-xs text-muted">
                <span className="tnum">{sync.pending}</span> change
                {sync.pending === 1 ? "" : "s"} not yet synced. They are in the export.
              </p>
            )}
          </div>
        </Group>

        <Group title="Account">
          <div className="divide-y divide-line">
            {email && (
              <p className="px-4 py-3 text-sm text-muted">
                Signed in as <span className="text-text">{email}</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text"
            >
              <SignOut size={16} />
              Sign out
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-danger"
            >
              <Trash size={16} />
              Delete account and all data
            </button>
          </div>
        </Group>
      </div>

      <Sheet
        open={confirmDelete}
        title="Delete your account?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              size="lg"
              block
              disabled={deleteText !== "DELETE" || deleting}
              onClick={() => void deleteAccount()}
            >
              {deleting ? "Deleting" : "Delete everything"}
            </Button>
            <Button size="lg" block onClick={() => setConfirmDelete(false)}>
              Keep my account
            </Button>
          </div>
        }
      >
        <div className="space-y-4 px-4 py-5">
          <p className="text-sm text-muted">
            This removes your account, every workout, every set, your plan, your weigh-ins and
            your protein log, from this phone and from the server. It cannot be undone.
          </p>
          <p className="text-sm text-muted">
            Export your data first if you want to keep it.
          </p>
          <Field
            label="Type DELETE to confirm"
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
          />
          {deleteError && (
            <p role="alert" className="rounded-ctl bg-danger-deep px-3.5 py-3 text-sm text-danger">
              {deleteError}
            </p>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-label font-medium uppercase tracking-wide text-faint">{title}</h2>
      <div className="overflow-hidden rounded-surface bg-surface">{children}</div>
    </section>
  );
}
