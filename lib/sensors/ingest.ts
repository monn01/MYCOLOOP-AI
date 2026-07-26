import { prisma } from "@/lib/db/client";
import { evaluateReadiness } from "@/lib/ai/evaluateReadiness";
import { BatchStatus, ReadinessStatus } from "@/lib/generated/prisma/enums";

// 2x MOVING_AVERAGE_WINDOW (lib/ai/evaluateReadiness.ts) + margin, supaya
// rate-of-change punya cukup data untuk dibandingkan.
const EVALUATION_WINDOW = 20;

export interface IngestSensorReadingInput {
  batchId: string;
  timestamp?: Date;
  suhu: number;
  kelembapan: number;
}

/**
 * Titik masuk tunggal untuk semua sumber data sensor (simulator sekarang,
 * MQTT bridge nanti di Phase 6): simpan pembacaan, jalankan AI engine, lalu
 * simpan hasilnya sebagai AIDecision. Anomali dan transisi ke "siap
 * sterilisasi" otomatis memicu Alert (lihat PRD.md #7.3 dan #4.4).
 */
export async function ingestSensorReading(input: IngestSensorReadingInput) {
  const reading = await prisma.sensorReading.create({
    data: {
      batchId: input.batchId,
      timestamp: input.timestamp ?? new Date(),
      suhu: input.suhu,
      kelembapan: input.kelembapan,
    },
  });

  const recentReadings = await prisma.sensorReading.findMany({
    where: { batchId: input.batchId },
    orderBy: { timestamp: "desc" },
    take: EVALUATION_WINDOW,
  });

  const result = evaluateReadiness(recentReadings.reverse());

  const decision = await prisma.aIDecision.create({
    data: {
      batchId: input.batchId,
      timestamp: reading.timestamp,
      status: result.status,
      confidence: result.confidence,
      reasoning: result.reasoning,
    },
  });

  let alert = null;

  if (result.anomaly) {
    alert = await prisma.alert.create({
      data: {
        batchId: input.batchId,
        timestamp: reading.timestamp,
        type: "ANOMALY",
        message: result.anomaly.message,
        resolved: false,
      },
    });
  } else if (result.status === ReadinessStatus.SIAP_STERILISASI) {
    const batch = await prisma.batch.findUnique({ where: { id: input.batchId } });

    // Cuma trigger sekali saat transisi RUNNING -> READY, bukan tiap tick
    // selama media tetap dalam kondisi siap.
    if (batch?.status === BatchStatus.RUNNING) {
      await prisma.batch.update({
        where: { id: input.batchId },
        data: { status: BatchStatus.READY },
      });

      alert = await prisma.alert.create({
        data: {
          batchId: input.batchId,
          timestamp: reading.timestamp,
          type: "READY",
          message: "Media siap disterilisasi.",
          resolved: false,
        },
      });
    }
  }

  return { reading, decision, alert };
}
