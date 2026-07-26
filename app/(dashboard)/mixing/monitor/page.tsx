"use client";

import { useActiveBatch } from "@/lib/hooks/use-active-batch";
import { useBatchStream } from "@/lib/hooks/use-batch-stream";
import { SensorChart } from "@/components/dashboard/sensor-chart";
import { AIDecisionPanel } from "@/components/dashboard/ai-decision-panel";
import { BATCH_STATUS_STYLE } from "@/lib/ui/status-styles";
import { MIXING_PARAM_CONFIG } from "@/lib/ui/param-configs";
import { PipelineStage } from "@/lib/generated/prisma/enums";

const STAGE = PipelineStage.MIXING;

export default function MixingMonitorPage() {
  const { batch, loading } = useActiveBatch(STAGE);
  const { readings, decisions, isLive } = useBatchStream(batch?.id ?? null, STAGE);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Memuat data monitor...</p>;
  }

  if (!batch) {
    return (
      <div className="rounded-card border border-status-neutral-border bg-status-neutral-bg p-6 text-center">
        <p className="text-sm font-medium text-card-foreground">Tidak ada batch mixing yang sedang berjalan.</p>
        <p className="mt-1 text-sm text-muted-foreground">Monitor akan aktif begitu ada batch Smart Mixing.</p>
      </div>
    );
  }

  const batchStyle = BATCH_STATUS_STYLE[batch.status];

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Batch Active — {batch.formula ?? "Tanpa nama formula"}
          </p>
          <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${batchStyle.badgeClassName}`}>
            {batchStyle.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
            {batchStyle.label}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{isLive ? "● live" : "○ offline"}</span>
      </div>

      <SensorChart data={readings} paramConfig={MIXING_PARAM_CONFIG} />

      <AIDecisionPanel decisions={decisions} stage={STAGE} />
    </div>
  );
}
