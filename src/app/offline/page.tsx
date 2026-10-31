import { LogoMark } from "@/components/brand/logo";

/**
 * Served by the service worker when a navigation fails and no cached copy of
 * that page exists. Reached rarely: once any tab has been visited, its own
 * cached HTML answers instead.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
      <LogoMark className="h-10 w-10 text-accent-dim" />
      <div>
        <h1 className="text-xl font-light tracking-tight">No signal, and this page is new</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
          Anything you already opened still works offline, and sets you log are saved on this
          phone and sync when you are back.
        </p>
      </div>
      <a
        href="/today"
        className="min-h-11 rounded-ctl bg-accent px-5 py-3 text-sm font-medium text-bg"
      >
        Back to Today
      </a>
    </main>
  );
}
