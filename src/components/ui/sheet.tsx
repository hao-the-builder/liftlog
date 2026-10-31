"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { X } from "@phosphor-icons/react/dist/ssr";

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Pins an action to the bottom, inside the safe area. */
  footer?: React.ReactNode;
}

/**
 * A bottom sheet.
 *
 * Built on <dialog> so focus trapping, Escape and the top layer come from the
 * platform instead of being reimplemented, which also means it is never
 * clipped by an ancestor's overflow. It enters from the bottom and leaves the
 * same way, because a panel that arrives one way and departs another reads as
 * two unrelated things.
 */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Clicking the backdrop (the dialog element itself, outside the panel)
      // dismisses, which is what every native sheet does.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label={title}
      className={clsx(
        "m-0 max-h-dvh w-full max-w-none translate-y-0 bg-transparent p-0 text-text",
        "mt-auto backdrop:bg-black/60",
        "open:animate-[sheet-up_280ms_var(--ease-drawer)]",
      )}
    >
      <div className="pane-blur-deep flex max-h-[85dvh] flex-col rounded-t-[18px] border-t border-line-strong">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-base font-medium tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-ctl text-muted transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text"
          >
            <X size={18} weight="bold" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-contain">{children}</div>

        {footer && (
          <div className="border-t border-line px-4 pt-3 pb-safe">
            <div className="pb-3">{footer}</div>
          </div>
        )}
      </div>
    </dialog>
  );
}
