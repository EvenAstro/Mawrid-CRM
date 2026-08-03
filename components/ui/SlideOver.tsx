"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        style={{ maxWidth: width }}
        className={`fixed left-0 top-0 z-50 flex h-screen w-full flex-col bg-[#f7faf9] shadow-[0_0_60px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between bg-gradient-to-br from-[#141c2e] via-[#173226] to-[#0f3a30] px-6 py-6">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-white/50">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-none rounded-xl p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {footer && (
          <div className="border-t border-[#e8f0ec] bg-white p-6">{footer}</div>
        )}
      </aside>
    </>
  );
}
