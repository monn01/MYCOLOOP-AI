"use client";

import { useEffect, useRef, useState } from "react";
import type { ReadinessStatus, AlertType, PipelineStage } from "@/lib/generated/prisma/enums";

/**
 * Shape minimal, sengaja tidak import tipe generated Prisma (client bundle
 * lebih ringan) — pola yang sama dipakai lib/ai/evaluateReadiness.ts.
 * Generik lintas stage: field selain id/timestamp/batchId beda-beda per
 * stage (suhu/kelembapan/ph vs kadarAir/rasioCN vs suhu/kelembapan/co2/cahaya).
 */
export type StreamReading = { id: string; timestamp: string; batchId: string } & Record<string, number>;

export interface StreamAIDecision {
  id: string;
  timestamp: string;
  status: ReadinessStatus;
  confidence: number;
  reasoning: string;
  batchId: string;
}

export interface StreamAlert {
  id: string;
  timestamp: string;
  type: AlertType;
  message: string;
  resolved: boolean;
  batchId: string;
}

const MAX_READINGS = 60;
const MAX_DECISIONS = 20;
const OFFLINE_AFTER_MS = 10_000;

const STREAM_ENDPOINT: Record<PipelineStage, string> = {
  MIXING: "/api/stream/mixing-readings",
  PRE_CONDITIONING: "/api/stream/sensor-readings",
  INCUBATION: "/api/stream/incubation-readings",
};

const READINGS_ENDPOINT: Record<PipelineStage, string> = {
  MIXING: "/api/mixing-readings",
  PRE_CONDITIONING: "/api/sensor-readings",
  INCUBATION: "/api/incubation-readings",
};

interface UseBatchStreamResult {
  readings: StreamReading[];
  latestDecision: StreamAIDecision | null;
  decisions: StreamAIDecision[];
  newAlerts: StreamAlert[];
  isLive: boolean;
}

/**
 * Wrap EventSource ke endpoint stream sesuai stage (design.md §5.4: dot
 * "live" hijau kalau ada data <10 detik terakhir, sage/"offline" kalau
 * lebih). `newAlerts` cuma menampung alert yang datang lewat SSE selama hook
 * ini hidup — pemanggil yang gabungkan dengan initial fetch dari GET /api/alerts.
 * AIDecision generik lintas stage jadi endpoint decisions selalu sama.
 */
export function useBatchStream(batchId: string | null, stage: PipelineStage): UseBatchStreamResult {
  const [readings, setReadings] = useState<StreamReading[]>([]);
  const [decisions, setDecisions] = useState<StreamAIDecision[]>([]);
  const [newAlerts, setNewAlerts] = useState<StreamAlert[]>([]);
  const [isLive, setIsLive] = useState(false);
  const lastReadingAtRef = useRef<number>(0);

  useEffect(() => {
    if (!batchId) {
      setReadings([]);
      setDecisions([]);
      setNewAlerts([]);
      setIsLive(false);
      return;
    }

    let cancelled = false;

    // Isi histori awal dulu — SSE cuma mengirim data yang lahir SETELAH
    // koneksi dibuka, jadi tanpa ini sparkline/timeline kosong sampai
    // pembacaan baru masuk.
    Promise.all([
      fetch(`${READINGS_ENDPOINT[stage]}?batchId=${batchId}&limit=${MAX_READINGS}`).then((r) => r.json()),
      fetch(`/api/batches/${batchId}/decisions?limit=${MAX_DECISIONS}`).then((r) => r.json()),
    ]).then(([readingsData, decisionsData]) => {
      if (cancelled) return;
      if (readingsData.readings?.length) setReadings(readingsData.readings);
      if (decisionsData.decisions?.length) setDecisions(decisionsData.decisions);
    });

    const source = new EventSource(`${STREAM_ENDPOINT[stage]}?batchId=${batchId}`);

    source.addEventListener("reading", (event) => {
      const reading = JSON.parse((event as MessageEvent).data) as StreamReading;
      lastReadingAtRef.current = Date.now();
      setIsLive(true);
      setReadings((prev) => [...prev, reading].slice(-MAX_READINGS));
    });

    source.addEventListener("decision", (event) => {
      const decision = JSON.parse((event as MessageEvent).data) as StreamAIDecision;
      setDecisions((prev) => [decision, ...prev].slice(0, MAX_DECISIONS));
    });

    source.addEventListener("alert", (event) => {
      const alert = JSON.parse((event as MessageEvent).data) as StreamAlert;
      setNewAlerts((prev) => [alert, ...prev]);
    });

    source.onerror = () => {
      setIsLive(false);
    };

    const offlineCheck = setInterval(() => {
      if (lastReadingAtRef.current && Date.now() - lastReadingAtRef.current > OFFLINE_AFTER_MS) {
        setIsLive(false);
      }
    }, 2000);

    return () => {
      cancelled = true;
      source.close();
      clearInterval(offlineCheck);
    };
  }, [batchId, stage]);

  return {
    readings,
    latestDecision: decisions[0] ?? null,
    decisions,
    newAlerts,
    isLive,
  };
}
