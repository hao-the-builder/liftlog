"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SupabaseNotConfigured } from "@/components/auth/not-configured";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useHydrated } from "@/lib/hooks/use-now";

const MIN_PASSWORD = 8;

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Keeps the form unsubmittable until its handlers are attached.
  const hydrated = useHydrated();

  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setBusy(true);
    setError(null);

    const { data, error: signUpError } = await getSupabaseBrowserClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
      },
    });

    if (signUpError) {
      setBusy(false);
      setError(signUpError.message);
      return;
    }

    // With email confirmation on, Supabase returns a user but no session.
    // With it off, the session is live and onboarding can start immediately.
    if (data.session) {
      // Hard navigation after sign-up so the proxy sees the new session cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/onboarding");
      return;
    }
    router.push(`/check-email?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted">
          Takes a minute. You build your own split next.
        </p>
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
          autoComplete="new-password"
          enterKeyHint="go"
          helper={`${MIN_PASSWORD} characters or more.`}
          required
        />

        {error && (
          <p role="alert" className="rounded-ctl bg-danger-deep px-3.5 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" block disabled={busy || !hydrated}>
          {busy ? "Creating account" : "Create account"}
        </Button>
      </form>

      <p className="text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-volt underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
