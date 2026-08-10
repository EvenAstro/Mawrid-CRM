"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

const STYLES: Record<ToastType, { bar: string; icon: string }> = {
  success: { bar: "border-l-emerald-500", icon: "✅" },
  error: { bar: "border-l-red-500", icon: "⚠️" },
  info: { bar: "border-l-[#1a5c4f]", icon: "ℹ️" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] border-l-4 bg-[var(--surface-raised)] px-4 py-3 shadow-lg ${s.bar} animate-[slideIn_0.2s_ease-out]`}
            >
              <span className="text-base">{s.icon}</span>
              <span className="text-sm font-medium text-[#1e1b4b]">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
