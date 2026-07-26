"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangleIcon, CheckCircleSolidIcon, XCircleIcon } from "@/components/ui/icons";

export type ToastTone = "safe" | "danger";

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  message: string;
  /** Toast danger (design.md §5.8) tidak auto-dismiss — harus ditutup manual. */
  autoDismiss: boolean;
}

interface ToastContextValue {
  push: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      if (toast.autoDismiss) {
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-full max-w-sm flex-col gap-2 sm:top-20">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-card border p-4 shadow-toast animate-toast-in ${
              toast.tone === "safe"
                ? "bg-status-safe-bg border-status-safe-border"
                : "bg-status-danger-bg border-status-danger-border"
            }`}
          >
            {toast.tone === "safe" ? (
              <CheckCircleSolidIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-safe" />
            ) : (
              <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-danger" />
            )}
            <div className="flex-1 text-sm">
              <p className={`font-medium ${toast.tone === "safe" ? "text-status-safe" : "text-status-danger"}`}>
                {toast.title}
              </p>
              <p className="mt-0.5 text-card-foreground">{toast.message}</p>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Tutup notifikasi"
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
