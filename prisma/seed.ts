import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db/client";
import { baseReadingAt } from "../lib/simulator/curve";
import { baseMixingReadingAt } from "../lib/simulator/curveMixing";
import { baseIncubationReadingAt } from "../lib/simulator/curveIncubation";

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
    reasoning: "Suhu 25-35°C, kelembapan 60-65% tercapai dan stabil selama beberapa pembacaan berturut-turut.",
  };
}

function mixingDecisionForProgress(progress: number) {
  if (progress < 0.4) {
    return {
      status: "BELUM_SIAP" as const,
      confidence: 0.6 + progress * 0.3,
      reasoning: "pH masih asam dan kekeruhan air rendah, bahan baku baru mulai dicampur.",
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
    reasoning: "pH 6.0-7.0, kekeruhan air 200-500 NTU tercapai dan stabil, siap dipindahkan ke Smart Pre-Conditioning.",
  };
}

function incubationDecisionForProgress(progress: number) {
  if (progress < 0.4) {
    return {
      status: "BELUM_SIAP" as const,
      confidence: 0.6 + progress * 0.3,
      reasoning: "Suhu, kelembapan, dan CO2 masih di luar rentang target, miselium baru mulai kolonisasi.",
    };
  }
  if (progress < 0.85) {
    return {
      status: "DALAM_PROSES" as const,
      confidence: 0.7 + progress * 0.2,
      reasoning: "Parameter mendekati rentang target, kolonisasi miselium berjalan normal.",
    };
  }
  return {
    status: "SIAP_STERILISASI" as const,
    confidence: 0.9 + Math.random() * 0.09,
    reasoning: "Suhu 22-28°C, kelembapan 70-90%, CO2 500-1500ppm stabil — miselium tumbuh optimal, siap fase pinhead.",
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
      const { suhu, kelembapan } = baseReadingAt(hourIntoProcess, totalHours);

      await prisma.sensorReading.create({
        data: { batchId: batch.id, timestamp, suhu, kelembapan },
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

  // === Smart Mixing (Stage 1) ===
  const mixingCompletedTotalHours = 4;
  const mixingCompletedStart = new Date(now - 2 * 24 * HOUR);
  const mixingCompletedEnd = new Date(mixingCompletedStart.getTime() + mixingCompletedTotalHours * HOUR);
  const batchMixingCompleted = await prisma.batch.create({
    data: {
      startTime: mixingCompletedStart,
      endTime: mixingCompletedEnd,
      status: "COMPLETED",
      stage: "MIXING",
      formula: "Limbah jagung + dedak (formula standar)",
      createdById: operator.id,
    },
  });

  const mixingRunningTotalHours = 4;
  const mixingRunningStart = new Date(now - 2 * HOUR);
  const batchMixingRunning = await prisma.batch.create({
    data: {
      startTime: mixingRunningStart,
      status: "RUNNING",
      stage: "MIXING",
      formula: "Limbah jagung + dedak (formula eksperimen)",
      createdById: operator.id,
    },
  });

  const mixingScenarios = [
    { batch: batchMixingCompleted, totalHours: mixingCompletedTotalHours, elapsedHours: mixingCompletedTotalHours, start: mixingCompletedStart },
    { batch: batchMixingRunning, totalHours: mixingRunningTotalHours, elapsedHours: 2, start: mixingRunningStart },
  ];

  for (const { batch, totalHours, elapsedHours, start } of mixingScenarios) {
    const stepMinutes = 5;
    const steps = Math.floor((elapsedHours * 60) / stepMinutes);

    for (let i = 0; i <= steps; i++) {
      const hourIntoProcess = (i * stepMinutes) / 60;
      const timestamp = new Date(start.getTime() + hourIntoProcess * HOUR);
      const { pH, kekeruhanAir, beratKg } = baseMixingReadingAt(hourIntoProcess, totalHours);

      await prisma.mixingReading.create({
        data: { batchId: batch.id, timestamp, pH, kekeruhanAir, beratKg },
      });

      if (i % 4 === 0) {
        const progress = Math.min(hourIntoProcess / totalHours, 1);
        const decision = mixingDecisionForProgress(progress);
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

  await prisma.alert.create({
    data: {
      batchId: batchMixingCompleted.id,
      timestamp: mixingCompletedEnd,
      type: "READY",
      message: "Bahan baku siap dipindahkan ke Smart Pre-Conditioning.",
      resolved: true,
    },
  });

  // Demo log command valve (lihat PRD.md §7.5/§12) — urutan buka/tutup
  // saluran limbah jagung -> dedak -> kapur untuk batch mixing yang sudah
  // selesai, supaya UI log command valve punya data contoh.
  const valveDemoSteps: Array<{ target: string; action: "OPEN" | "CLOSE"; offsetHours: number; reasoning: string }> = [
    { target: "valve:limbah_jagung", action: "OPEN", offsetHours: 0, reasoning: "Mengisi saluran Limbah Jagung: berat total 0.0kg dari target 100kg." },
    { target: "valve:limbah_jagung", action: "CLOSE", offsetHours: 1.5, reasoning: "Mengisi saluran Dedak: berat total 72.0kg dari target 100kg." },
    { target: "valve:dedak", action: "OPEN", offsetHours: 1.5, reasoning: "Mengisi saluran Dedak: berat total 72.0kg dari target 100kg." },
    { target: "valve:dedak", action: "CLOSE", offsetHours: 3, reasoning: "Mengisi saluran Kapur: berat total 91.0kg dari target 100kg." },
    { target: "valve:kapur", action: "OPEN", offsetHours: 3, reasoning: "Mengisi saluran Kapur: berat total 91.0kg dari target 100kg." },
    { target: "valve:kapur", action: "CLOSE", offsetHours: 3.8, reasoning: "Formula tercampur: berat 100.0kg, pH dan kekeruhan air di rentang target dan stabil — siap dipindahkan ke Smart Pre-Conditioning." },
  ];
  for (const step of valveDemoSteps) {
    await prisma.actuatorCommand.create({
      data: {
        batchId: batchMixingCompleted.id,
        timestamp: new Date(mixingCompletedStart.getTime() + step.offsetHours * HOUR),
        stage: "MIXING",
        target: step.target,
        action: step.action,
        triggeredBy: "AI",
        reasoning: step.reasoning,
      },
    });
  }

  // === Smart Incubation Monitoring (Stage 3) ===
  const incubationCompletedTotalHours = 72;
  const incubationCompletedStart = new Date(now - 8 * 24 * HOUR);
  const incubationCompletedEnd = new Date(incubationCompletedStart.getTime() + incubationCompletedTotalHours * HOUR);
  const batchIncubationCompleted = await prisma.batch.create({
    data: {
      startTime: incubationCompletedStart,
      endTime: incubationCompletedEnd,
      status: "COMPLETED",
      stage: "INCUBATION",
      formula: "Baglog batch #A1 (formula standar)",
      createdById: operator.id,
    },
  });

  const incubationRunningTotalHours = 72;
  const incubationRunningStart = new Date(now - 20 * HOUR);
  const batchIncubationRunning = await prisma.batch.create({
    data: {
      startTime: incubationRunningStart,
      status: "RUNNING",
      stage: "INCUBATION",
      formula: "Baglog batch #B2 (formula eksperimen)",
      createdById: operator.id,
    },
  });

  const incubationScenarios = [
    { batch: batchIncubationCompleted, totalHours: incubationCompletedTotalHours, elapsedHours: incubationCompletedTotalHours, start: incubationCompletedStart },
    { batch: batchIncubationRunning, totalHours: incubationRunningTotalHours, elapsedHours: 20, start: incubationRunningStart },
  ];

  for (const { batch, totalHours, elapsedHours, start } of incubationScenarios) {
    const stepMinutes = 60;
    const steps = Math.floor((elapsedHours * 60) / stepMinutes);

    for (let i = 0; i <= steps; i++) {
      const hourIntoProcess = (i * stepMinutes) / 60;
      const timestamp = new Date(start.getTime() + hourIntoProcess * HOUR);
      const { suhu, kelembapan, co2, cahaya } = baseIncubationReadingAt(hourIntoProcess, totalHours);

      await prisma.incubationReading.create({
        data: { batchId: batch.id, timestamp, suhu, kelembapan, co2, cahaya },
      });

      if (i % 2 === 0) {
        const progress = Math.min(hourIntoProcess / totalHours, 1);
        const decision = incubationDecisionForProgress(progress);
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

  await prisma.alert.create({
    data: {
      batchId: batchIncubationCompleted.id,
      timestamp: incubationCompletedEnd,
      type: "READY",
      message: "Miselium tumbuh optimal, siap masuk fase pembentukan pinhead/panen.",
      resolved: true,
    },
  });

  await prisma.alert.create({
    data: {
      batchId: batchIncubationRunning.id,
      timestamp: new Date(incubationRunningStart.getTime() + 10 * HOUR),
      type: "CONTAMINATION",
      message: "CO2 melonjak bersamaan kelembapan turun drastis pada jam ke-10, indikasi risiko kontaminasi. Segera periksa baglog secara visual.",
      resolved: false,
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
