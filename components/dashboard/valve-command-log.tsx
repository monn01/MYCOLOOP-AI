"use client";

import { useEffect, useState } from "react";
import { GaugeIcon } from "@/components/ui/icons";

interface ActuatorCommandRow {
  id: string;
  timestamp: string;
  target: string;
  action: "OPEN" | "CLOSE" | "ON" | "OFF";
  triggeredBy: "AI" | "MANUAL";
  reasoning: string;
}

function formatTarget(target: string): string {
  const [, name] = target.split(":");
  return (name ?? target).replace(/_/g, " ");
}

const ACTION_STYLE: Record<ActuatorCommandRow["action"], string> = {
  OPEN: "border-status-safe-border bg-status-safe-bg text-status-safe",
  ON: "border-status-safe-border bg-status-safe-bg text-status-safe",
  CLOSE: "border-border bg-background-subtle text-muted-foreground",
  OFF: "border-border bg-background-subtle text-muted-foreground",
};

/**
 * Log command aktuator (solenoid valve Mixing) — read-only, dipicu AI atau
 * override manual operator (lihat PRD.md §7.5/§12). Polling sederhana, belum
 * lewat SSE (cukup untuk MVP, audit trail bukan kontrol real-time).
 */
export function ValveCommandLog({ batchId }: { batchId: string | null }) {
  const [commands, setCommands] = useState<ActuatorCommandRow[]>([]);

  useEffect(() => {
    if (!batchId) {
      setCommands([]);
      return;
    }
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/actuator-commands?batchId=${batchId}&limit=10`);
      if (cancelled || !res.ok) return;
      const data = await res.json();
      setCommands(data.commands ?? []);
    }

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [batchId]);

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card lg:p-6">
      <div className="flex items-center gap-2">
        <GaugeIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-card-foreground">Log Command Valve</h2>
      </div>

      {commands.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Belum ada command aktuator untuk batch ini.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {commands.map((c) => (
            <li key={c.id} className="rounded-md border border-border/60 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize text-card-foreground">{formatTarget(c.target)}</span>
                <span className={`rounded-full border px-2 py-0.5 font-medium ${ACTION_STYLE[c.action]}`}>
                  {c.action}
                  {c.triggeredBy === "MANUAL" ? " · manual" : ""}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{c.reasoning}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
