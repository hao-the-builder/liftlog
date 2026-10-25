"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Barbell, CalendarBlank, ChartLineUp, Scales } from "@phosphor-icons/react/dist/ssr";

/**
 * Bottom tab bar.
 *
 * Names are concrete rather than generic: a lifter looking for their squat
 * numbers goes to Progress, not to "Home". Every target is at least 44px and
 * the whole bar sits above the home indicator via the safe-area inset.
 */
const TABS = [
  { href: "/today", label: "Today", Icon: Barbell },
  { href: "/progress", label: "Progress", Icon: ChartLineUp },
  { href: "/body", label: "Body", Icon: Scales },
  { href: "/plan", label: "Plan", Icon: CalendarBlank },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="border-t border-line bg-surface/95 backdrop-blur-sm pb-safe"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-14 flex-col items-center justify-center gap-1",
                  "transition-colors duration-150 ease-out active:scale-[0.97]",
                  active ? "text-volt" : "text-faint hover:text-muted",
                )}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} />
                <span className="text-[11px] font-medium tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
