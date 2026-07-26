import { prisma } from "@/lib/db/client";
import { evaluateIncubationReadiness } from "@/lib/ai/evaluateIncubationReadiness";
import { BatchStatus, ReadinessStatus } from "@/lib/generated/prisma/enums";

const EVALUATION_WINDOW = 20;

export interface IngestIncubationReadingInput {
  batchId: string;
  timestamp?: Date;
  suhu: number;
  kelembapan: number;
  co2: number;
  cahaya: number;
}

/**
 * Titik masuk tunggal untuk data sensor Smart Incubation Monitoring — mirror
 * lib/sensors/ingest.ts (Pre-Conditioning). Alert dari pola kontaminasi
 * dipetakan ke AlertType.CONTAMINATION (bukan ANOMALY generik) supaya
 * operator bisa membedakan urgensinya di UI (lihat lib/ui/status-styles.ts).
 */
export async function ingestIncubationReading(input: IngestIncubationReadingInput) {
  const reading = await prisma.incubationReading.create({
    data: {
      batchId: input.batchId,
      timestamp: input.timestamp ?? new Date(),
      suhu: input.suhu,
      kelembapan: input.kelembapan,
      co2: input.co2,
      cahaya: input.cahaya,
    },
  });

  const recentReadings = await prisma.incubationReading.findMany({
    where: { batchId: input.batchId },
    orderBy: { timestamp: "desc" },
    take: EVALUATION_WINDOW,
  });

  const result = evaluateIncubationReadiness(recentReadings.reverse());

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
        type: result.anomaly.isContamination ? "CONTAMINATION" : "ANOMALY",
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
          message: "Miselium tumbuh optimal, siap masuk fase pembentukan pinhead/panen.",
          resolved: false,
        },
      });
    }
  }

  return { reading, decision, alert };
}
