"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckIcon, AlertIcon, DotIcon } from "@/components/icons";

type ToastType = "success" | "error" | "info";

export interface ToastOptions {
  type?: ToastType;
  /**
   * An undo affordance — proposal 24. Soft delete (`deleted_at`) already
   * exists in the data model, so the expensive half of undo was already
   * built; this is the half that lets a user reach it. A destructive action
   * without undo makes people hesitate over every click.
   */
  undo?: () => void | Promise<void>;
  /** Milliseconds before auto-dismiss. Undoable toasts get longer by default. */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  undo?: () => void | Promise<void>;
}

type ShowToast = (message: string, options?: ToastType | ToastOptions) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const STYLES: Record<ToastType, { rail: string; tone: string; Icon: typeof CheckIcon }> = {
  success: {
    rail: "border-s-[var(--status-success-fg)]",
    tone: "text-[color:var(--status-success-fg)]",
    Icon: CheckIcon,
  },
  error: {
    rail: "border-s-[var(--status-danger-fg)]",
    tone: "text-[color:var(--status-danger-fg)]",
    Icon: AlertIcon,
  },
  info: {
    rail: "border-s-[var(--content-accent)]",
    tone: "text-[color:var(--content-accent)]",
    Icon: DotIcon,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, options) => {
      const opts: ToastOptions = typeof options === "string" ? { type: options } : (options ?? {});
      const type = opts.type ?? "success";
      const id = Date.now() + Math.random();
      setToasts((list) => [...list, { id, message, type, undo: opts.undo }]);
      // An undoable toast stays longer — four seconds is not enough time to
      // notice a mistake, decide, and reach the button.
      const ms = opts.duration ?? (opts.undo ? 9000 : 4000);
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 left-6 z-[100] flex flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 rounded-[var(--radius-md)] border-s-2 bg-[var(--surface-raised)] py-3 pe-3 ps-4 e-overlay ${s.rail}`}
            >
              <span className={`flex-none ${s.tone}`}>
                <s.Icon className="h-4 w-4" />
              </span>
              <p dir="auto" className="t-body-sm min-w-0 flex-1 text-[color:var(--content-primary)]">
                {t.message}
              </p>
              {t.undo && (
                <button
                  type="button"
                  onClick={async () => {
                    dismiss(t.id);
                    await t.undo?.();
                  }}
                  className="t-caption flex-none rounded-[var(--radius-xs)] px-2 py-1 font-bold text-[color:var(--content-accent)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-accent-subtle)]"
                >تراجع</button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="إغلاق الإشعار"
                className="flex-none rounded-[var(--radius-xs)] p-1 text-[color:var(--content-tertiary)] transition-colors duration-[var(--motion-fast)] hover:text-[color:var(--content-primary)]"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
