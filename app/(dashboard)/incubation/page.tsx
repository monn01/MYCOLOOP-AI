"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useActiveBatch } from "@/lib/hooks/use-active-batch";
import { useBatchStream, type StreamAlert } from "@/lib/hooks/use-batch-stream";
import { useToast } from "@/components/dashboard/toast-provider";
import { HeroCard } from "@/components/dashboard/hero-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import { INCUBATION_THRESHOLDS } from "@/lib/ai/evaluateIncubationReadiness";
import { ReadinessStatus, PipelineStage } from "@/lib/generated/prisma/enums";
import { ArrowRightIcon, ThermometerIcon, DropletIcon, CloudIcon, SunIcon } from "@/components/ui/icons";

const STAGE = PipelineStage.INCUBATION;

export default function IncubationDashboardPage() {
  const { data: session } = useSession();
  const { batch, loading } = useActiveBatch(STAGE);
  const { readings, latestDecision, newAlerts, isLive } = useBatchStream(batch?.id ?? null, STAGE);
  const { push } = useToast();

  const [alerts, setAlerts] = useState<StreamAlert[]>([]);
  const toastedAlertIds = useRef(new Set<string>());
  const lastToastedDecisionStatus = useRef<ReadinessStatus | null>(null);

  useEffect(() => {
    if (!batch) {
      setAlerts([]);
      return;
    }
    fetch(`/api/alerts?batchId=${batch.id}&resolved=false`)
      .then((res) => res.json())
      .then((data) => setAlerts(data.alerts ?? []));
  }, [batch]);

  useEffect(() => {
    if (newAlerts.length === 0) return;
    setAlerts((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const fresh = newAlerts.filter((a) => !existingIds.has(a.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });

    for (const alert of newAlerts) {
      if (toastedAlertIds.current.has(alert.id)) continue;
      toastedAlertIds.current.add(alert.id);
      if (alert.type === "CONTAMINATION") {
        push({ tone: "danger", title: "Risiko Kontaminasi Terdeteksi", message: alert.message, autoDismiss: false });
      } else if (alert.type === "ANOMALY") {
        push({ tone: "danger", title: "Anomali Terdeteksi", message: alert.message, autoDismiss: false });
      }
    }
  }, [newAlerts, push]);

  useEffect(() => {
    if (!latestDecision) return;
    if (
      latestDecision.status === ReadinessStatus.SIAP_STERILISASI &&
      lastToastedDecisionStatus.current !== ReadinessStatus.SIAP_STERILISASI
    ) {
      push({ tone: "safe", title: "Siap Panen", message: latestDecision.reasoning, autoDismiss: true });
    }
    lastToastedDecisionStatus.current = latestDecision.status;
  }, [latestDecision, push]);

  const dismissAlert = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const latestReading = readings[readings.length - 1] ?? null;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Memuat status inkubasi...</p>;
  }

  if (!batch) {
    return (
      <div className="rounded-card border border-status-neutral-border bg-status-neutral-bg p-6 text-center">
        <p className="text-sm font-medium text-card-foreground">Tidak ada batch inkubasi yang sedang berjalan.</p>
        <p className="mt-1 text-sm text-muted-foreground">Mulai batch baru untuk memantau ruang inkubasi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <HeroCard
        batchId={batch.id}
        batchStatus={batch.status}
        stage={STAGE}
        decision={latestDecision}
        isLive={isLive}
        userName={session?.user.name ?? undefined}
      />

      <AlertBanner alerts={alerts} onDismiss={dismissAlert} />

      {latestReading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          <MetricCard
            label="Suhu"
            value={latestReading.suhu}
            unit="°C"
            range={INCUBATION_THRESHOLDS.suhu}
            sparkline={readings.map((r) => r.suhu)}
            isLive={isLive}
            icon={ThermometerIcon}
          />
          <MetricCard
            label="Kelembapan"
            value={latestReading.kelembapan}
            unit="%"
            range={INCUBATION_THRESHOLDS.kelembapan}
            sparkline={readings.map((r) => r.kelembapan)}
            isLive={isLive}
            icon={DropletIcon}
          />
          <MetricCard
            label="CO2"
            value={latestReading.co2}
            unit="ppm"
            decimals={0}
            range={INCUBATION_THRESHOLDS.co2}
            sparkline={readings.map((r) => r.co2)}
            isLive={isLive}
            icon={CloudIcon}
          />
          <MetricCard
            label="Cahaya"
            value={latestReading.cahaya}
            unit="lux"
            decimals={0}
            range={INCUBATION_THRESHOLDS.cahaya}
            sparkline={readings.map((r) => r.cahaya)}
            isLive={isLive}
            icon={SunIcon}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Menunggu data sensor pertama masuk...</p>
      )}

      <Link
        href="/incubation/monitor"
        className="flex items-center justify-between rounded-card border border-border bg-card p-4 shadow-card hover:bg-background-subtle"
      >
        <span className="text-sm font-medium text-card-foreground">Lihat detail Smart Incubation Monitor</span>
        <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}
