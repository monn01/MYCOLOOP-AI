"use client";

import { useEffect, useState } from "react";
import type { BatchStatus, PipelineStage } from "@/lib/generated/prisma/enums";

export interface ActiveBatch {
  id: string;
  startTime: string;
  endTime: string | null;
  status: BatchStatus;
  stage: PipelineStage;
  formula: string | null;
}

interface UseActiveBatchResult {
  batch: ActiveBatch | null;
  loading: boolean;
}

/**
 * MVP satu chamber per stage (PRD.md §5 non-goals) — "batch aktif" adalah
 * RUNNING terbaru untuk stage tsb, atau kalau tidak ada, READY terbaru
 * (sudah siap tapi belum ditandai selesai/dibatalkan). null kalau tidak ada
 * batch aktif (idle). Dipakai lintas 3 dashboard stage (Mixing/
 * Pre-Conditioning/Incubation) — bedanya cuma parameter `stage`.
 */
export function useActiveBatch(stage: PipelineStage): UseActiveBatchResult {
  const [batch, setBatch] = useState<ActiveBatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const runningRes = await fetch(`/api/batches?status=RUNNING&stage=${stage}&limit=1`);
        const runningData = await runningRes.json();
        if (cancelled) return;

        if (runningData.batches?.length > 0) {
          setBatch(runningData.batches[0]);
          return;
        }

        const readyRes = await fetch(`/api/batches?status=READY&stage=${stage}&limit=1`);
        const readyData = await readyRes.json();
        if (cancelled) return;

        setBatch(readyData.batches?.[0] ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  return { batch, loading };
}
