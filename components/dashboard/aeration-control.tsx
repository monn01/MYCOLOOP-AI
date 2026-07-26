"use client";

import { useState } from "react";
import { WindIcon } from "@/components/ui/icons";

/**
 * UI-only (design.md §5.7) — belum ada aktuator fisik/endpoint kontrol fan
 * (baru masuk scope Phase 6 setelah ESP32 siap, lihat TASKPLAN.md). State di
 * sini murni tampilan, tidak dikirim ke backend.
 */
export function AerationControl() {
  const [mode, setMode] = useState<"manual" | "auto">("auto");
  const [speed, setSpeed] = useState(50);
  const [on, setOn] = useState(true);

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card lg:p-6">
      <div className="flex items-center gap-2">
        <WindIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-card-foreground">Kontrol Aerasi</h2>
      </div>

      <div className="mt-3 inline-flex rounded-md border border-border p-1 text-sm">
        <button
          onClick={() => setMode("manual")}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            mode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Manual
        </button>
        <button
          onClick={() => setMode("auto")}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            mode === "auto" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Otomatis
        </button>
      </div>

      <div className={`mt-4 space-y-3 ${mode === "auto" ? "pointer-events-none opacity-50" : ""}`}>
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Kecepatan Fan</span>
            <span className="font-mono font-semibold text-card-foreground">{speed}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="mt-1.5 w-full accent-[var(--color-green-600)]"
            aria-label="Kecepatan fan"
          />
        </div>

        <button
          onClick={() => setOn((v) => !v)}
          className={`h-11 w-full rounded-md border-2 text-sm font-semibold transition-colors ${
            on ? "border-primary text-primary" : "border-border text-muted-foreground"
          }`}
        >
          {on ? "Fan Menyala" : "Fan Mati"}
        </button>
      </div>

      {mode === "auto" && (
        <p className="mt-3 text-xs text-muted-foreground">AI mengatur aerasi otomatis.</p>
      )}
    </div>
  );
}
