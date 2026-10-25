"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SupabaseNotConfigured } from "@/components/auth/not-configured";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useHydrated } from "@/lib/hooks/use-now";

export default function LoginPage() {
  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  // An expired or already-used email link redirects here with the reason.
  const linkError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Keeps the form unsubmittable until its handlers are attached.
  const hydrated = useHydrated();

  const error = formError ?? linkError;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);

    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setBusy(false);
      setFormError(
        signInError.message === "Invalid login credentials"
          ? "That email and password do not match an account."
          : signInError.message,
      );
      return;
    }

    const next = params.get("next");
    // A full navigation, not a client push: the session cookie was only just
    // written, and this guarantees the proxy evaluates the new one.
    window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/today");
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted">Your plan and your history, on any device.</p>
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
          enterKeyHint="next"
          required
        />
        <Field
          label="Password"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          enterKeyHint="go"
          required
        />

        {error && (
          <p role="alert" className="rounded-ctl bg-danger-deep px-3.5 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" block disabled={busy || !hydrated}>
          {busy ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <div className="flex flex-col gap-3 text-sm">
        <Link
          href="/forgot-password"
          className="text-muted underline-offset-4 hover:text-text hover:underline"
        >
          Forgot your password?
        </Link>
        <p className="text-muted">
          No account yet?{" "}
          <Link href="/signup" className="font-medium text-volt underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Matches the form's shape so the swap does not move the page. */
function LoginSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-28 rounded-ctl bg-surface-2" />
        <div className="h-5 w-56 rounded-ctl bg-surface" />
      </div>
      <div className="flex flex-col gap-5">
        <div className="h-[72px] rounded-ctl bg-surface" />
        <div className="h-[72px] rounded-ctl bg-surface" />
        <div className="h-13 rounded-ctl bg-surface-2" />
      </div>
    </div>
  );
}
