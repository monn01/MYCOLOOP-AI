import { prisma } from "@/lib/db/client";
import { evaluateMixingReadiness, MIXING_CHANNELS } from "@/lib/ai/evaluateMixingReadiness";
import { applySafetyEnvelope, sensorSanityCheck, type ActuatorAction } from "@/lib/ai/actuatorSafetyEnvelope";
import { BatchStatus, ReadinessStatus, PipelineStage } from "@/lib/generated/prisma/enums";

const EVALUATION_WINDOW = 20;
const ACTUATOR_HISTORY_WINDOW = 10;

// Sensor sanity bounds untuk safety envelope (lihat PRD.md §12) — cek "masuk
// akal secara fisik", bukan target readiness (itu MIXING_THRESHOLDS).
const PH_SANITY_BOUNDS = { min: 0, max: 14 };
const KEKERUHAN_SANITY_BOUNDS = { min: 0, max: 5000 };

export interface IngestMixingReadingInput {
  batchId: string;
  timestamp?: Date;
  pH: number;
  kekeruhanAir: number;
  beratKg: number;
}

function valveTarget(channelName: string): string {
  return `valve:${channelName}`;
}

/**
 * Titik masuk tunggal untuk data sensor Smart Mixing — mirror
 * lib/sensors/ingest.ts (Pre-Conditioning). Transisi RUNNING->READY berarti
 * bahan baku siap dipindah ke Smart Pre-Conditioning. Sejak pivot arsitektur
 * 2026-07-26 (lihat PRD.md §7.5), ingest ini juga menjalankan safety envelope
 * dan mencatat command aktuator (solenoid valve) yang benar-benar dieksekusi.
 */
export async function ingestMixingReading(input: IngestMixingReadingInput) {
  const reading = await prisma.mixingReading.create({
    data: {
      batchId: input.batchId,
      timestamp: input.timestamp ?? new Date(),
      pH: input.pH,
      kekeruhanAir: input.kekeruhanAir,
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

  const sensorsOk =
    sensorSanityCheck(reading.pH, PH_SANITY_BOUNDS) &&
    sensorSanityCheck(reading.kekeruhanAir, KEKERUHAN_SANITY_BOUNDS) &&
    reading.beratKg >= 0;

  const actuatorCommands = [];

  for (const channel of MIXING_CHANNELS) {
    const target = valveTarget(channel.name);
    const desiredAction: ActuatorAction = result.desiredValveState[channel.name] === "OPEN" ? "OPEN" : "CLOSE";

    const recentHistory = await prisma.actuatorCommand.findMany({
      where: { batchId: input.batchId, target },
      orderBy: { timestamp: "desc" },
      take: ACTUATOR_HISTORY_WINDOW,
    });

    const lastAction = recentHistory[0]?.action ?? "CLOSE";
    if (lastAction === desiredAction) continue; // tidak ada perubahan state, tidak perlu command baru

    const envelope = applySafetyEnvelope({
      desiredAction,
      recentHistory: recentHistory.map((c) => ({ action: c.action, triggeredBy: c.triggeredBy })),
      sensorsOk,
    });

    if (envelope.action === null) continue; // override manual aktif, AI tidak bertindak

    const command = await prisma.actuatorCommand.create({
      data: {
        batchId: input.batchId,
        timestamp: reading.timestamp,
        stage: PipelineStage.MIXING,
        target,
        action: envelope.action,
        triggeredBy: "AI",
        reasoning: envelope.overridden ? envelope.reasoning : result.reasoning,
      },
    });
    actuatorCommands.push(command);
  }

  return { reading, decision, alert, actuatorCommands };
}
