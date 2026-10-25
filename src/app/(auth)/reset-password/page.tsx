"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SupabaseNotConfigured } from "@/components/auth/not-configured";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useHydrated } from "@/lib/hooks/use-now";

const MIN_PASSWORD = 8;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Keeps the form unsubmittable until its handlers are attached.
  const hydrated = useHydrated();
  const [ready, setReady] = useState<boolean | null>(null);

  // Reaching this page means the recovery link has already been exchanged for
  // a session by /auth/confirm. Without one there is nothing to update, and
  // saying so beats a cryptic failure after the user types a new password.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two do not match.");
      return;
    }

    setBusy(true);
    setError(null);

    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(updateError.message);
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/today");
  }

  if (ready === false) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold tracking-tight">This link has expired</h1>
        <p className="text-sm text-muted">
          Reset links work once and last an hour. Request a new one and open it on this phone.
        </p>
        <Button
          variant="primary"
          size="lg"
          block
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          onClick={() => window.location.assign("/forgot-password")}
        >
          Send a new link
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
        <p className="mt-1.5 text-sm text-muted">You stay signed in on this device afterwards.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          helper={`${MIN_PASSWORD} characters or more.`}
          required
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          enterKeyHint="go"
          required
        />
        {error && (
          <p role="alert" className="rounded-ctl bg-danger-deep px-3.5 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block disabled={busy || !hydrated || ready === null}>
          {busy ? "Saving" : "Save password"}
        </Button>
      </form>
    </div>
  );
}
