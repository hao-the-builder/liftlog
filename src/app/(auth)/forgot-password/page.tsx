"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SupabaseNotConfigured } from "@/components/auth/not-configured";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useHydrated } from "@/lib/hooks/use-now";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Keeps the form unsubmittable until its handlers are attached.
  const hydrated = useHydrated();

  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password` },
    );

    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted">
          If an account exists for <span className="text-text">{email}</span>, a reset link is
          on its way. The link works once and expires in an hour.
        </p>
        <Link href="/login" className="text-sm font-medium text-volt underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-1.5 text-sm text-muted">We will send you a link to set a new one.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field
          label="Email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          enterKeyHint="send"
          required
        />
        {error && (
          <p role="alert" className="rounded-ctl bg-danger-deep px-3.5 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block disabled={busy || !hydrated}>
          {busy ? "Sending" : "Send reset link"}
        </Button>
      </form>

      <Link href="/login" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
