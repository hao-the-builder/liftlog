/**
 * Shown instead of an auth form when the app has no Supabase credentials.
 *
 * A blank screen or a redirect loop is the usual outcome of a missing
 * .env.local. Saying exactly which two values are missing and where they come
 * from costs one component and saves the first ten minutes of setup.
 */
export function SupabaseNotConfigured() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[1.75rem] font-light leading-none tracking-tight">Not connected yet</h1>
      <p className="text-sm text-muted">
        Liftlog needs a Supabase project before anyone can sign in. Create one, then add
        these to <code className="text-text">.env.local</code> and restart the dev server.
      </p>

      <ul className="flex flex-col divide-y divide-line pane rounded-surface">
        {["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].map((name) => (
          <li key={name} className="px-4 py-3 font-mono text-xs text-text">
            {name}
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted">
        Both come from Project Settings, API. The full walkthrough, including the
        migrations and the seed scripts, is in <code className="text-text">README.md</code>.
      </p>
    </div>
  );
}
