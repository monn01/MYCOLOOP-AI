import { prisma } from "@/lib/db/client";
import { evaluateMixingReadiness } from "@/lib/ai/evaluateMixingReadiness";
import { BatchStatus, ReadinessStatus } from "@/lib/generated/prisma/enums";

const EVALUATION_WINDOW = 20;

export interface IngestMixingReadingInput {
  batchId: string;
  timestamp?: Date;
  kadarAir: number;
  rasioCN: number;
  beratKg: number;
}

/**
 * Titik masuk tunggal untuk data sensor Smart Mixing — mirror
 * lib/sensors/ingest.ts (Pre-Conditioning). Transisi RUNNING->READY berarti
 * bahan baku siap dipindah ke Smart Pre-Conditioning.
 */
export async function ingestMixingReading(input: IngestMixingReadingInput) {
  const reading = await prisma.mixingReading.create({
    data: {
      batchId: input.batchId,
      timestamp: input.timestamp ?? new Date(),
      kadarAir: input.kadarAir,
      rasioCN: input.rasioCN,
      beratKg: input.beratKg,
    },
  });

  const recentReadings = await prisma.mixingReading.findMany({
    where: { batchId: input.batchId },
    orderBy: { timestamp: "desc" },
    take: EVALUATION_WINDOW,
  });

  const result = evaluateMixingReadiness(recentReadings.reverse());

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
          message: "Bahan baku siap dipindahkan ke Smart Pre-Conditioning.",
          resolved: false,
        },
      });
    }
  }

  return { reading, decision, alert };
}
