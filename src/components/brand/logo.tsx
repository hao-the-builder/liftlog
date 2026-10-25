import clsx from "clsx";

/**
 * The mark: a plate on a bar, seen from the side.
 *
 * A ring for the plate, a bar running through it and out past both edges.
 * It is the one piece of authored artwork in the app, it survives down to a
 * 32px favicon, and it is the shape the installed icon is built from.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={clsx("block", className)}>
      {/* The bar, in the accent, because the load is the point. */}
      <rect x="2" y="21.5" width="44" height="5" rx="1" fill="currentColor" opacity="0.35" />
      {/* The plate. */}
      <circle cx="24" cy="24" r="13.5" fill="none" stroke="currentColor" strokeWidth="5" />
      <rect x="20" y="21.5" width="8" height="5" rx="1" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <LogoMark className="h-7 w-7 text-volt" />
      <span className="text-lg font-bold tracking-tight text-text">Liftlog</span>
    </div>
  );
}
