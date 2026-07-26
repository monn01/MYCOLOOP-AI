import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { PipelineStage } from "@/lib/generated/prisma/enums";
import { BATCH_STATUS_STYLE, getReadinessLabel, ALERT_TYPE_STYLE } from "@/lib/ui/status-styles";
import { formatDate, formatDuration } from "@/lib/ui/format";
import {
  PRE_CONDITIONING_PARAM_CONFIG,
  MIXING_PARAM_CONFIG,
  INCUBATION_PARAM_CONFIG,
  type ParamConfig,
} from "@/lib/ui/param-configs";
import { SensorChart, type SensorChartPoint } from "@/components/dashboard/sensor-chart";
import { CheckCircleSolidIcon, AlertTriangleIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

async function getReadingsForStage(batchId: string, stage: PipelineStage): Promise<{ data: SensorChartPoint[]; paramConfig: ParamConfig }> {
  if (stage === PipelineStage.MIXING) {
    const rows = await prisma.mixingReading.findMany({ where: { batchId }, orderBy: { timestamp: "asc" }, take: 1000 });
    return {
      paramConfig: MIXING_PARAM_CONFIG,
      data: rows.map((r) => ({ timestamp: r.timestamp.toISOString(), pH: r.pH, kekeruhanAir: r.kekeruhanAir })),
    };
  }
  if (stage === PipelineStage.INCUBATION) {
    const rows = await prisma.incubationReading.findMany({ where: { batchId }, orderBy: { timestamp: "asc" }, take: 1000 });
    return {
      paramConfig: INCUBATION_PARAM_CONFIG,
      data: rows.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        suhu: r.suhu,
        kelembapan: r.kelembapan,
        co2: r.co2,
        cahaya: r.cahaya,
      })),
    };
  }
  const rows = await prisma.sensorReading.findMany({ where: { batchId }, orderBy: { timestamp: "asc" }, take: 1000 });
  return {
    paramConfig: PRE_CONDITIONING_PARAM_CONFIG,
    data: rows.map((r) => ({ timestamp: r.timestamp.toISOString(), suhu: r.suhu, kelembapan: r.kelembapan })),
  };
}

async function getBatchDetail(id: string) {
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return null;

  const [{ data: chartData, paramConfig }, decisions, alerts] = await Promise.all([
    getReadingsForStage(id, batch.stage),
    prisma.aIDecision.findMany({ where: { batchId: id }, orderBy: { timestamp: "desc" } }),
    prisma.alert.findMany({ where: { batchId: id }, orderBy: { timestamp: "desc" } }),
  ]);

  return { batch, chartData, paramConfig, decisions, alerts };
}

function formatClock(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

export default async function BatchDetailPage({ params }: { params: { id: string } }) {
  const data = await getBatchDetail(params.id);
  if (!data) notFound();

  const { batch, chartData, paramConfig, decisions, alerts } = data;
  const style = BATCH_STATUS_STYLE[batch.status];

  const timeline = [
    ...decisions.map((d) => ({ kind: "decision" as const, timestamp: d.timestamp, decision: d })),
    ...alerts.map((a) => ({ kind: "alert" as const, timestamp: a.timestamp, alert: a })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <Link href="/riwayat" className="text-xs font-medium text-primary hover:underline">
          ← Kembali ke Riwayat Produksi
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.badgeClassName}`}>
            {style.label}
          </span>
          <h1 className="text-lg font-semibold text-foreground">{batch.formula ?? "Tanpa nama formula"}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(batch.startTime.toISOString())}
          {batch.endTime ? ` — ${formatDate(batch.endTime.toISOString())}` : ""} · Durasi{" "}
          {formatDuration(batch.startTime.toISOString(), batch.endTime?.toISOString() ?? null)}
        </p>
      </div>

      {chartData.length > 0 ? (
        <SensorChart data={chartData} paramConfig={paramConfig} />
      ) : (
        <p className="text-sm text-muted-foreground">Tidak ada data sensor untuk batch ini.</p>
      )}

      <div>
        <h2 className="text-sm font-semibold text-foreground">Riwayat Keputusan & Alert</h2>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada catatan.</p>
        ) : (
          <ol className="mt-3 space-y-4 border-l border-status-neutral-border pl-4">
            {timeline.map((entry) => {
              if (entry.kind === "decision") {
                const label = getReadinessLabel(entry.decision.status, batch.stage);
                const isSafe = entry.decision.status === "SIAP_STERILISASI";
                const isProgress = entry.decision.status === "DALAM_PROSES";
                return (
                  <li key={`d-${entry.decision.id}`} className="relative text-sm">
                    <span
                      className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${
                        isSafe ? "bg-status-safe" : isProgress ? "bg-status-progress" : "bg-status-caution"
                      }`}
                      aria-hidden
                    />
                    <div className="flex items-center gap-2">
                      {isSafe && <CheckCircleSolidIcon className="h-3.5 w-3.5 text-status-safe" />}
                      <span className="font-medium text-card-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground">{formatClock(entry.decision.timestamp)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.decision.reasoning}</p>
                  </li>
                );
              }
              const s = ALERT_TYPE_STYLE[entry.alert.type];
              return (
                <li key={`a-${entry.alert.id}`} className="relative text-sm">
                  <span
                    className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${s.tone === "danger" ? "bg-status-danger" : s.tone === "caution" ? "bg-status-caution" : "bg-status-safe"}`}
                    aria-hidden
                  />
                  <div className="flex items-center gap-2">
                    {s.tone === "danger" || s.tone === "caution" ? (
                      <AlertTriangleIcon className={`h-3.5 w-3.5 ${s.tone === "danger" ? "text-status-danger" : "text-status-caution"}`} />
                    ) : (
                      <CheckCircleSolidIcon className="h-3.5 w-3.5 text-status-safe" />
                    )}
                    <span className="font-medium text-card-foreground">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{formatClock(entry.alert.timestamp)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{entry.alert.message}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
