"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TabBar } from "@/components/shell/tab-bar";
import { RestTimerBar } from "@/components/shell/rest-timer-bar";
import { SyncIndicator } from "@/components/shell/sync-indicator";
import { InstallHint } from "@/components/pwa/install-hint";
import { useSession } from "@/components/providers/session-provider";

/**
 * The app shell.
 *
 * A fixed-height column with one scrolling region, which is what keeps the
 * tab bar and the rest timer planted while the content moves, and stops the
 * mobile URL bar collapsing and expanding under the user mid-set.
 *
 * The auth check here is a second line, not the only one: the proxy already
 * redirects signed-out requests. This one exists because an offline launch
 * is served straight from the service worker and never reaches the proxy.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, userId, profile } = useSession();

  // undefined means the local read has not finished; null means there is
  // genuinely no profile yet, which is what sends a new account to setup.
  const needsOnboarding =
    Boolean(userId) && profile !== undefined && (profile === null || !profile.onboarded_at);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (needsOnboarding) router.replace("/onboarding");
  }, [loading, userId, needsOnboarding, pathname, router]);

  if (loading || !userId || needsOnboarding) return <ShellSkeleton />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <InstallHint />
      <SyncIndicator />
      <main className="min-h-0 flex-1 overflow-y-auto scroll-contain pt-safe">{children}</main>
      <RestTimerBar />
      <TabBar />
    </div>
  );
}

/**
 * The shape of the shell while the session resolves. A skeleton rather than a
 * spinner, so the page does not jump when the real content lands.
 */
function ShellSkeleton() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden" aria-busy="true">
      <div className="min-h-0 flex-1 space-y-3 p-5 pt-safe">
        <div className="h-5 w-24 rounded-ctl bg-surface" />
        <div className="h-24 pane rounded-surface" />
        <div className="h-40 pane rounded-surface" />
        <div className="h-40 pane rounded-surface" />
      </div>
      <div className="h-[72px] border-t border-line bg-surface pb-safe" />
    </div>
  );
}
