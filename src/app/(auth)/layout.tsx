import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    // dvh, not vh: on a phone, vh is the height with the URL bar collapsed, so
    // a vh layout overflows by the height of that bar on load.
    <div className="flex min-h-dvh flex-col px-5 pt-safe pb-safe">
      <header className="flex justify-center pt-10 pb-8">
        <Wordmark />
      </header>
      <main className="mx-auto w-full max-w-sm flex-1">{children}</main>
      <footer className="py-6 text-center text-xs text-faint">
        Logs stay on your phone first. They sync when you have signal.
      </footer>
    </div>
  );
}
