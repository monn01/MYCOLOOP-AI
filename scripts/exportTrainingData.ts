import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/db/client";
import { PipelineStage } from "../lib/generated/prisma/enums";

/**
 * Phase 7 prep (lihat TASKPLAN.md) — export batch histori jadi training set mentah.
 * BUKAN training model: cuma menyiapkan pipeline export supaya siap dipakai begitu
 * data batch nyata dari hardware (Phase 6) terkumpul minimal 20-30 batch per stage.
 * Menjalankan ini sekarang cuma menghasilkan data dari batch simulasi/seed —
 * jangan dipakai sebagai training set final, lihat PRD.md §12 soal syarat data nyata.
 */

const STAGE_READING_RELATION: Record<PipelineStage, "sensorReadings" | "mixingReadings" | "incubationReadings"> = {
  PRE_CONDITIONING: "sensorReadings",
  MIXING: "mixingReadings",
  INCUBATION: "incubationReadings",
};

const MIN_BATCHES_RECOMMENDED = 20;

interface CliOptions {
  stage: PipelineStage | "all";
  outDir: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { stage: "all", outDir: "training-data" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--stage": {
        const value = next()?.toUpperCase();
        if (value === "MIXING" || value === "PRE_CONDITIONING" || value === "INCUBATION") {
          options.stage = value;
        } else {
          console.warn(`--stage tidak dikenal (${value}), pakai "all"`);
        }
        break;
      }
      case "--out":
        options.outDir = next() ?? options.outDir;
        break;
      default:
        console.warn(`Argumen tidak dikenal, diabaikan: ${arg}`);
    }
  }
  return options;
}

async function exportStage(stage: PipelineStage, outDir: string) {
  const relation = STAGE_READING_RELATION[stage];

  const batches = await prisma.batch.findMany({
    where: { stage, status: { in: ["COMPLETED", "ABORTED"] } },
    orderBy: { startTime: "asc" },
    include: {
      sensorReadings: { orderBy: { timestamp: "asc" } },
      mixingReadings: { orderBy: { timestamp: "asc" } },
      incubationReadings: { orderBy: { timestamp: "asc" } },
      aiDecisions: { orderBy: { timestamp: "asc" } },
      alerts: { orderBy: { timestamp: "asc" } },
    },
  });

  const records = batches.map((batch) => {
    const readings = batch[relation];
    const lastDecision = batch.aiDecisions[batch.aiDecisions.length - 1];
    const hadContamination = batch.alerts.some((a) => a.type === "CONTAMINATION");

    return {
      batchId: batch.id,
      stage: batch.stage,
      formula: batch.formula,
      status: batch.status,
      startTime: batch.startTime,
      endTime: batch.endTime,
      durationHours: batch.endTime
        ? (batch.endTime.getTime() - batch.startTime.getTime()) / (60 * 60 * 1000)
        : null,
      readings,
      aiDecisions: batch.aiDecisions.map((d) => ({
        timestamp: d.timestamp,
        status: d.status,
        confidence: d.confidence,
        reasoning: d.reasoning,
      })),
      alerts: batch.alerts.map((a) => ({
        timestamp: a.timestamp,
        type: a.type,
        message: a.message,
        resolved: a.resolved,
      })),
      // label kandidat buat training: hasil akhir siklus batch, bukan cuma satu keputusan AI
      label: {
        finalReadinessStatus: lastDecision?.status ?? null,
        finalBatchStatus: batch.status,
        contaminationDetected: hadContamination,
      },
    };
  });

  const filePath = path.join(outDir, `${stage.toLowerCase()}.json`);
  await writeFile(filePath, JSON.stringify(records, null, 2), "utf-8");

  console.log(`[${stage}] ${records.length} batch selesai diekspor -> ${filePath}`);
  if (records.length < MIN_BATCHES_RECOMMENDED) {
    console.log(
      `   >> Belum cukup untuk training (rekomendasi minimal ${MIN_BATCHES_RECOMMENDED} batch nyata, lihat TASKPLAN.md Phase 7).`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.outDir, { recursive: true });

  const stages: PipelineStage[] =
    options.stage === "all" ? ["MIXING", "PRE_CONDITIONING", "INCUBATION"] : [options.stage];

  for (const stage of stages) {
    await exportStage(stage, options.outDir);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
