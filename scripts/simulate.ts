import "dotenv/config";
import { prisma } from "../lib/db/client";
import { getOrCreateDefaultUser } from "../lib/db/default-user";
import { baseReadingAt, applyAnomaly, DEFAULT_DURATION_HOURS, type AnomalyType } from "../lib/simulator/curve";

const HOUR_MS = 60 * 60 * 1000;

interface CliOptions {
  batchId?: string;
  intervalSeconds: number;
  speedMinutesPerTick: number;
  durationHours: number;
  anomaly?: AnomalyType;
  anomalyAtTick?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    intervalSeconds: 5,
    speedMinutesPerTick: 30,
    durationHours: DEFAULT_DURATION_HOURS,
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
        options.anomaly = next() === "ph" ? "ph-drop" : "suhu-spike";
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
    where: { status: "RUNNING" },
    orderBy: { startTime: "desc" },
  });
  if (existing) return existing;

  const user = await getOrCreateDefaultUser();

  return prisma.batch.create({
    data: {
      status: "RUNNING",
      formula: "Batch simulasi otomatis",
      createdById: user.id,
    },
  });
}

/** Lanjutkan progress dari pembacaan terakhir batch ini, kalau ada. */
async function resolveStartingProgressHours(batchId: string, startTime: Date) {
  const last = await prisma.sensorReading.findFirst({
    where: { batchId },
    orderBy: { timestamp: "desc" },
  });
  if (!last) return 0;
  return (last.timestamp.getTime() - startTime.getTime()) / HOUR_MS;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const batch = await getOrCreateRunningBatch(options.batchId);

  let elapsedHours = await resolveStartingProgressHours(batch.id, batch.startTime);
  const remainingHours = Math.max(options.durationHours - elapsedHours, 0);
  const estimatedTicks = Math.ceil((remainingHours * 60) / options.speedMinutesPerTick);
  const anomalyAtTick = options.anomalyAtTick ?? Math.floor(estimatedTicks / 2);

  console.log(`Simulasi berjalan untuk batch ${batch.id} (mulai dari jam ke-${elapsedHours.toFixed(1)})`);
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

    // timestamp = startTime + elapsedHours (bukan real "now") supaya progress tetap
    // konsisten dipercepat oleh --speed, dan resume antar-run bisa dihitung ulang
    // langsung dari timestamp pembacaan terakhir.
    let point = baseReadingAt(elapsedHours, options.durationHours);
    if (options.anomaly && tick === anomalyAtTick) {
      point = applyAnomaly(point, options.anomaly);
      console.log(`>> Anomali disuntikkan (${options.anomaly})`);
    }

    await prisma.sensorReading.create({
      data: {
        batchId: batch.id,
        timestamp: new Date(batch.startTime.getTime() + elapsedHours * HOUR_MS),
        suhu: point.suhu,
        kelembapan: point.kelembapan,
        ph: point.ph,
      },
    });

    console.log(
      `[tick ${tick}] jam-ke-${elapsedHours.toFixed(1)} suhu=${point.suhu}°C kelembapan=${point.kelembapan}% pH=${point.ph}`
    );

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
