import "dotenv/config";
import { prisma } from "../lib/db/client";
import { getOrCreateDefaultUser } from "../lib/db/default-user";
import { ingestIncubationReading } from "../lib/sensors/ingestIncubation";
import {
  baseIncubationReadingAt,
  applyIncubationAnomaly,
  DEFAULT_INCUBATION_DURATION_HOURS,
  type IncubationAnomalyType,
} from "../lib/simulator/curveIncubation";

const HOUR_MS = 60 * 60 * 1000;

interface CliOptions {
  batchId?: string;
  intervalSeconds: number;
  speedMinutesPerTick: number;
  durationHours: number;
  anomaly?: IncubationAnomalyType;
  anomalyAtTick?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    intervalSeconds: 5,
    speedMinutesPerTick: 120,
    durationHours: DEFAULT_INCUBATION_DURATION_HOURS,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--batch":
        options.batchId = next();
        break;
      case "--interval":
        options.intervalSeconds = Number(next());
        break;
      case "--speed":
        options.speedMinutesPerTick = Number(next());
        break;
      case "--duration":
        options.durationHours = Number(next());
        break;
      case "--anomaly":
        options.anomaly = next() === "kontaminasi" ? "contamination-pattern" : "suhu-spike";
        break;
      case "--anomaly-tick":
        options.anomalyAtTick = Number(next());
        break;
      default:
        console.warn(`Argumen tidak dikenal, diabaikan: ${arg}`);
    }
  }

  return options;
}

async function getOrCreateRunningBatch(batchId?: string) {
  if (batchId) {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error(`Batch ${batchId} tidak ditemukan.`);
    if (batch.status !== "RUNNING") {
      throw new Error(`Batch ${batchId} berstatus ${batch.status}, harus RUNNING untuk disimulasikan.`);
    }
    return batch;
  }

  const existing = await prisma.batch.findFirst({
    where: { status: "RUNNING", stage: "INCUBATION" },
    orderBy: { startTime: "desc" },
  });
  if (existing) return existing;

  const user = await getOrCreateDefaultUser();

  return prisma.batch.create({
    data: {
      status: "RUNNING",
      stage: "INCUBATION",
      formula: "Batch inkubasi simulasi otomatis",
      createdById: user.id,
    },
  });
}

async function resolveStartingProgressHours(batchId: string, startTime: Date, tickHours: number) {
  const last = await prisma.incubationReading.findFirst({
    where: { batchId },
    orderBy: { timestamp: "desc" },
  });
  if (!last) return 0;
  return (last.timestamp.getTime() - startTime.getTime()) / HOUR_MS + tickHours;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const batch = await getOrCreateRunningBatch(options.batchId);

  let elapsedHours = await resolveStartingProgressHours(
    batch.id,
    batch.startTime,
    options.speedMinutesPerTick / 60
  );
  const remainingHours = Math.max(options.durationHours - elapsedHours, 0);
  const estimatedTicks = Math.ceil((remainingHours * 60) / options.speedMinutesPerTick);
  const anomalyAtTick = options.anomalyAtTick ?? Math.floor(estimatedTicks / 2);

  console.log(`Simulasi Smart Incubation berjalan untuk batch ${batch.id} (mulai dari jam ke-${elapsedHours.toFixed(1)})`);
  console.log(
    `interval=${options.intervalSeconds}s, speed=${options.speedMinutesPerTick} menit-simulasi/tick, ` +
      `duration=${options.durationHours}jam${options.anomaly ? `, anomaly=${options.anomaly} @tick ${anomalyAtTick}` : ""}`
  );
  console.log("Tekan Ctrl+C untuk berhenti.\n");

  let running = true;
  process.on("SIGINT", () => {
    console.log("\nDihentikan manual (SIGINT).");
    running = false;
  });

  let tick = 0;
  while (running) {
    if (elapsedHours >= options.durationHours) {
      console.log("Durasi simulasi tercapai, berhenti.");
      break;
    }

    let point = baseIncubationReadingAt(elapsedHours, options.durationHours);
    if (options.anomaly && tick === anomalyAtTick) {
      point = applyIncubationAnomaly(point, options.anomaly);
      console.log(`>> Anomali disuntikkan (${options.anomaly})`);
    }

    const { decision, alert } = await ingestIncubationReading({
      batchId: batch.id,
      timestamp: new Date(batch.startTime.getTime() + elapsedHours * HOUR_MS),
      suhu: point.suhu,
      kelembapan: point.kelembapan,
      co2: point.co2,
      cahaya: point.cahaya,
    });

    console.log(
      `[tick ${tick}] jam-ke-${elapsedHours.toFixed(1)} suhu=${point.suhu}°C kelembapan=${point.kelembapan}% CO2=${point.co2}ppm cahaya=${point.cahaya}lux ` +
        `-> AI: ${decision.status} (${(decision.confidence * 100).toFixed(0)}%)`
    );
    if (alert) {
      console.log(`   >> Alert dibuat: [${alert.type}] ${alert.message}`);
    }

    elapsedHours += options.speedMinutesPerTick / 60;
    tick++;
    await delay(options.intervalSeconds * 1000);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
