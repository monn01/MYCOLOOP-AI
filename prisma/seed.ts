import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Kurva pre-conditioning realistis: basah & panas di awal, menurun & stabil
 * menjelang siap sterilisasi (lihat PRD.md #2 dan TASKPLAN.md Phase 2).
 */
function readingAt(hourIntoProcess: number, totalHours: number) {
  const progress = Math.min(hourIntoProcess / totalHours, 1);

  const suhu = 38 - 8 * progress + (Math.random() - 0.5) * 0.8;
  const kelembapan = 75 - 12 * progress + (Math.random() - 0.5) * 1.5;
  const ph = 5.4 + 1.4 * progress + (Math.random() - 0.5) * 0.1;

  return {
    suhu: Number(suhu.toFixed(2)),
    kelembapan: Number(kelembapan.toFixed(2)),
    ph: Number(ph.toFixed(2)),
  };
}

function decisionForProgress(progress: number) {
  if (progress < 0.4) {
    return {
      status: "BELUM_SIAP" as const,
      confidence: 0.6 + progress * 0.3,
      reasoning: "Suhu dan kelembapan masih di luar rentang aman, media baru mulai pre-conditioning.",
    };
  }
  if (progress < 0.85) {
    return {
      status: "DALAM_PROSES" as const,
      confidence: 0.7 + progress * 0.2,
      reasoning: "Parameter mendekati rentang target, moving average menunjukkan tren stabil.",
    };
  }
  return {
    status: "SIAP_STERILISASI" as const,
    confidence: 0.9 + Math.random() * 0.09,
    reasoning: "Suhu 25-35°C, pH 6-7, kelembapan 60-65% tercapai dan stabil selama beberapa pembacaan berturut-turut.",
  };
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@mycoloop.ai" },
    update: {},
    create: {
      name: "Admin UMKM",
      email: "admin@mycoloop.ai",
      password: passwordHash,
      role: "ADMIN",
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: "operator@mycoloop.ai" },
    update: {},
    create: {
      name: "Operator Chamber",
      email: "operator@mycoloop.ai",
      password: passwordHash,
      role: "OPERATOR",
    },
  });

  const now = Date.now();
  const HOUR = 60 * 60 * 1000;

  // Batch 1: sudah selesai & disterilisasi (riwayat produksi)
  const completedTotalHours = 46;
  const completedStart = new Date(now - 5 * 24 * HOUR);
  const completedEnd = new Date(completedStart.getTime() + completedTotalHours * HOUR);
  const batchCompleted = await prisma.batch.create({
    data: {
      startTime: completedStart,
      endTime: completedEnd,
      status: "COMPLETED",
      formula: "Limbah jagung + dedak + kapur (formula standar)",
      createdById: operator.id,
    },
  });

  // Batch 2: sudah siap sterilisasi, menunggu diproses lanjut
  const readyTotalHours = 40;
  const readyStart = new Date(now - 40 * HOUR);
  const batchReady = await prisma.batch.create({
    data: {
      startTime: readyStart,
      status: "READY",
      formula: "Limbah jagung + dedak + kapur (formula standar)",
      createdById: operator.id,
    },
  });

  // Batch 3: sedang berjalan, baru sebagian proses (dipakai simulator Phase 2)
  const runningTotalHours = 48;
  const runningStart = new Date(now - 10 * HOUR);
  const batchRunning = await prisma.batch.create({
    data: {
      startTime: runningStart,
      status: "RUNNING",
      formula: "Limbah jagung + dedak + kapur (formula eksperimen kadar air tinggi)",
      createdById: operator.id,
    },
  });

  const scenarios = [
    { batch: batchCompleted, totalHours: completedTotalHours, elapsedHours: completedTotalHours, start: completedStart },
    { batch: batchReady, totalHours: readyTotalHours, elapsedHours: readyTotalHours, start: readyStart },
    { batch: batchRunning, totalHours: runningTotalHours, elapsedHours: 10, start: runningStart },
  ];

  for (const { batch, totalHours, elapsedHours, start } of scenarios) {
    const stepMinutes = 30;
    const steps = Math.floor((elapsedHours * 60) / stepMinutes);

    for (let i = 0; i <= steps; i++) {
      const hourIntoProcess = (i * stepMinutes) / 60;
      const timestamp = new Date(start.getTime() + hourIntoProcess * HOUR);
      const { suhu, kelembapan, ph } = readingAt(hourIntoProcess, totalHours);

      await prisma.sensorReading.create({
        data: { batchId: batch.id, timestamp, suhu, kelembapan, ph },
      });

      // Simpan AI decision tiap 2 jam agar tidak terlalu padat
      if (i % 4 === 0) {
        const progress = Math.min(hourIntoProcess / totalHours, 1);
        const decision = decisionForProgress(progress);
        await prisma.aIDecision.create({
          data: {
            batchId: batch.id,
            timestamp,
            status: decision.status,
            confidence: Number(decision.confidence.toFixed(2)),
            reasoning: decision.reasoning,
          },
        });
      }
    }
  }

  // Alert: batch completed & ready sempat dapat notifikasi "siap sterilisasi"
  await prisma.alert.create({
    data: {
      batchId: batchCompleted.id,
      timestamp: completedEnd,
      type: "READY",
      message: "Media siap disterilisasi setelah 46 jam pre-conditioning.",
      resolved: true,
    },
  });

  await prisma.alert.create({
    data: {
      batchId: batchReady.id,
      timestamp: new Date(readyStart.getTime() + readyTotalHours * HOUR),
      type: "READY",
      message: "Media siap disterilisasi, menunggu tindakan operator.",
      resolved: false,
    },
  });

  // Alert: batch running sempat kena anomali (lonjakan suhu) untuk testing UI alert
  await prisma.alert.create({
    data: {
      batchId: batchRunning.id,
      timestamp: new Date(runningStart.getTime() + 6 * HOUR),
      type: "ANOMALY",
      message: "Lonjakan suhu terdeteksi (>38°C) pada jam ke-6, cek aerasi chamber.",
      resolved: true,
    },
  });

  console.log("Seed selesai:");
  console.log(`- Users: ${admin.email}, ${operator.email} (password: password123)`);
  console.log(`- Batch COMPLETED: ${batchCompleted.id}`);
  console.log(`- Batch READY: ${batchReady.id}`);
  console.log(`- Batch RUNNING: ${batchRunning.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
