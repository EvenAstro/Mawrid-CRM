"use client";

import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "480px",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const trapTab = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // Without this, Tab walks straight out of the panel and into the page
    // behind it — the user is then typing into a form they cannot see.
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // Remember what opened this so focus can go back there on close. Dropping
    // the user at the top of the document is how a keyboard user loses their
    // place in a 200-row table.
    returnFocusTo.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else trapTab(e);
    };
    window.addEventListener("keydown", onKey);

    const t = setTimeout(() => {
      const panel = panelRef.current;
      const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel)?.focus();
    }, 60);

    // The page behind must not scroll while a panel is over it.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      returnFocusTo.current?.focus?.();
    };
  }, [open, onClose, trapTab]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-[var(--surface-inverse)]/25 backdrop-blur-[6px] transition-opacity duration-[var(--motion-slow)] ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        tabIndex={-1}
        style={{ maxWidth: width }}
<<<<<<< HEAD
        className={`fixed left-0 top-0 z-50 flex h-screen w-full flex-col bg-[#f7faf9] shadow-[0_0_60px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between bg-[#141c2e] px-6 py-6">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-white/50">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-none rounded-xl p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
=======
        className={`fixed left-0 top-0 z-50 flex h-screen w-full flex-col bg-[var(--surface-sunken)] e-overlay transition-transform duration-[var(--motion-slow)] ease-[var(--ease-standard)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between bg-[var(--surface-inverse)] px-6 py-6">
          <div className="min-w-0">
            <h2 className="t-title-3 truncate text-[color:var(--content-inverse-primary)]">{title}</h2>
            {subtitle && (
              <p className="t-body-sm mt-0.5 text-[color:var(--content-inverse-tertiary)]">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="flex-none rounded-[var(--radius-sm)] p-1.5 text-[color:var(--content-inverse-tertiary)] transition-colors duration-[var(--motion-fast)] hover:bg-white/10 hover:text-[color:var(--content-inverse-primary)]"
>>>>>>> main
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {footer && (
<<<<<<< HEAD
          <div className="border-t border-[#e8f0ec] bg-white p-6">{footer}</div>
=======
          <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6">{footer}</div>
>>>>>>> main
        )}
      </aside>
    </>
  );
}
