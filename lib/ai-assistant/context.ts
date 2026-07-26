import { prisma } from "@/lib/db/client";
import { BatchStatus, PipelineStage } from "@/lib/generated/prisma/enums";
import { getReadinessLabel } from "@/lib/ui/status-styles";

const STAGE_LABEL: Record<PipelineStage, string> = {
  MIXING: "Smart Mixing",
  PRE_CONDITIONING: "Smart Pre-Conditioning",
  INCUBATION: "Smart Incubation Monitoring",
};

interface StageSnapshot {
  stage: PipelineStage;
  stageLabel: string;
  batchId: string | null;
  formula: string | null;
  batchStatus: BatchStatus | null;
  readingText: string | null;
  decisionText: string | null;
  alerts: string[];
}

async function getActiveBatch(stage: PipelineStage) {
  const running = await prisma.batch.findFirst({
    where: { stage, status: BatchStatus.RUNNING },
    orderBy: { startTime: "desc" },
  });
  if (running) return running;
  return prisma.batch.findFirst({
    where: { stage, status: BatchStatus.READY },
    orderBy: { startTime: "desc" },
  });
}

async function getReadingText(stage: PipelineStage, batchId: string): Promise<string | null> {
  if (stage === PipelineStage.MIXING) {
    const r = await prisma.mixingReading.findFirst({ where: { batchId }, orderBy: { timestamp: "desc" } });
    return r ? `pH ${r.pH}, Kekeruhan Air ${r.kekeruhanAir}NTU, Berat ${r.beratKg}kg` : null;
  }
  if (stage === PipelineStage.INCUBATION) {
    const r = await prisma.incubationReading.findFirst({ where: { batchId }, orderBy: { timestamp: "desc" } });
    return r ? `Suhu ${r.suhu}°C, Kelembapan ${r.kelembapan}%, CO2 ${r.co2}ppm, Cahaya ${r.cahaya}lux` : null;
  }
  const r = await prisma.sensorReading.findFirst({ where: { batchId }, orderBy: { timestamp: "desc" } });
  return r ? `Suhu ${r.suhu}°C, Kelembapan ${r.kelembapan}%` : null;
}

async function getStageSnapshot(stage: PipelineStage): Promise<StageSnapshot> {
  const batch = await getActiveBatch(stage);
  const stageLabel = STAGE_LABEL[stage];

  if (!batch) {
    return { stage, stageLabel, batchId: null, formula: null, batchStatus: null, readingText: null, decisionText: null, alerts: [] };
  }

  const [readingText, decision, alerts] = await Promise.all([
    getReadingText(stage, batch.id),
    prisma.aIDecision.findFirst({ where: { batchId: batch.id }, orderBy: { timestamp: "desc" } }),
    prisma.alert.findMany({ where: { batchId: batch.id, resolved: false }, orderBy: { timestamp: "desc" }, take: 5 }),
  ]);

  const decisionText = decision
    ? `${getReadinessLabel(decision.status, stage)} (confidence ${Math.round(decision.confidence * 100)}%) — "${decision.reasoning}"`
    : null;

  return {
    stage,
    stageLabel,
    batchId: batch.id,
    formula: batch.formula,
    batchStatus: batch.status,
    readingText,
    decisionText,
    alerts: alerts.map((a) => `[${a.type}] ${a.message}`),
  };
}

/** Ambil snapshot batch aktif + keputusan AI + alert terbaru dari ketiga stage sekaligus. */
export async function buildStageSnapshots(): Promise<StageSnapshot[]> {
  return Promise.all([
    getStageSnapshot(PipelineStage.MIXING),
    getStageSnapshot(PipelineStage.PRE_CONDITIONING),
    getStageSnapshot(PipelineStage.INCUBATION),
  ]);
}

/** Render snapshot jadi teks yang ditempel ke system prompt Gemini. */
export function formatSnapshotsForPrompt(snapshots: StageSnapshot[]): string {
  return snapshots
    .map((s) => {
      if (!s.batchId) {
        return `### ${s.stageLabel}\nTidak ada batch aktif saat ini.`;
      }
      const lines = [
        `### ${s.stageLabel}`,
        `Batch: ${s.formula ?? "(tanpa nama formula)"} — status ${s.batchStatus}`,
        s.readingText ? `Sensor terkini: ${s.readingText}` : "Belum ada data sensor masuk.",
        s.decisionText ? `Keputusan AI terakhir: ${s.decisionText}` : "Belum ada keputusan AI.",
        s.alerts.length > 0 ? `Alert belum ditangani:\n${s.alerts.map((a) => `- ${a}`).join("\n")}` : "Tidak ada alert aktif.",
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}
