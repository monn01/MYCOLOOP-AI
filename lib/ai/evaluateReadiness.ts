import { ReadinessStatus } from "../generated/prisma/enums";

/**
 * Minimal shape dibutuhkan dari SensorReading. Sengaja tidak import tipe
 * `SensorReading` dari `lib/generated/prisma` supaya logic AI ini tidak
 * terikat ke client Prisma yang di-generate ulang tiap `prisma generate`.
 */
export interface SensorReadingInput {
  timestamp: Date;
  suhu: number;
  kelembapan: number;
  ph: number;
}

export const THRESHOLDS = {
  suhu: { min: 25, max: 35 },
  ph: { min: 6, max: 7 },
  kelembapan: { min: 60, max: 65 },
} as const;

const MOVING_AVERAGE_WINDOW = 5;

// Lonjakan/drop mendadak antar dua pembacaan berurutan (lihat PRD.md #7.3).
const SUHU_SPIKE_DELTA = 6;
const PH_DROP_DELTA = 1.0;

// Batas "rate of change" moving average antar window supaya dianggap stabil.
const STABLE_RATE = {
  suhu: 0.5,
  kelembapan: 1.0,
  ph: 0.15,
};

export type AnomalyType = "SUHU_SPIKE" | "PH_DROP";

export interface AnomalyDetection {
  type: AnomalyType;
  message: string;
}

export interface AIDecisionResult {
  status: ReadinessStatus;
  confidence: number;
  reasoning: string;
  anomaly: AnomalyDetection | null;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function movingAverageOf(points: SensorReadingInput[], key: "suhu" | "kelembapan" | "ph"): number {
  return average(points.map((p) => p[key]));
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}

/**
 * Rule-based readiness classifier untuk MVP (lihat PRD.md #7.3 dan
 * TASKPLAN.md Phase 4). `readings` tidak perlu urut, function ini yang
 * mengurutkan berdasarkan timestamp menaik.
 */
export function evaluateReadiness(readings: SensorReadingInput[]): AIDecisionResult {
  if (readings.length === 0) {
    return {
      status: ReadinessStatus.BELUM_SIAP,
      confidence: 0,
      reasoning: "Belum ada data sensor untuk dievaluasi.",
      anomaly: null,
    };
  }

  const sorted = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  if (previous) {
    const suhuDelta = latest.suhu - previous.suhu;
    if (suhuDelta > SUHU_SPIKE_DELTA) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.85,
        reasoning: `Lonjakan suhu terdeteksi: naik ${suhuDelta.toFixed(1)}°C dari pembacaan sebelumnya (${previous.suhu}°C → ${latest.suhu}°C).`,
        anomaly: {
          type: "SUHU_SPIKE",
          message: `Suhu melonjak ${suhuDelta.toFixed(1)}°C dalam satu interval pembacaan (${previous.suhu}°C → ${latest.suhu}°C).`,
        },
      };
    }

    const phDelta = previous.ph - latest.ph;
    if (phDelta > PH_DROP_DELTA) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.85,
        reasoning: `Penurunan pH drastis terdeteksi: turun ${phDelta.toFixed(2)} dari pembacaan sebelumnya (${previous.ph} → ${latest.ph}).`,
        anomaly: {
          type: "PH_DROP",
          message: `pH turun ${phDelta.toFixed(2)} dalam satu interval pembacaan (${previous.ph} → ${latest.ph}).`,
        },
      };
    }
  }

  const windowSize = Math.min(MOVING_AVERAGE_WINDOW, sorted.length);
  const window = sorted.slice(-windowSize);

  const suhuAvg = movingAverageOf(window, "suhu");
  const kelembapanAvg = movingAverageOf(window, "kelembapan");
  const phAvg = movingAverageOf(window, "ph");

  const withinTarget =
    inRange(suhuAvg, THRESHOLDS.suhu) &&
    inRange(kelembapanAvg, THRESHOLDS.kelembapan) &&
    inRange(phAvg, THRESHOLDS.ph);

  // Bandingkan moving average window terakhir dengan window sebelumnya untuk
  // menilai tren: kalau datanya belum cukup untuk dua window penuh, anggap
  // tren belum bisa dipastikan (rates = null).
  let rates: { suhu: number; kelembapan: number; ph: number } | null = null;
  if (sorted.length >= windowSize * 2) {
    const priorWindow = sorted.slice(-windowSize * 2, -windowSize);
    rates = {
      suhu: Math.abs(suhuAvg - movingAverageOf(priorWindow, "suhu")),
      kelembapan: Math.abs(kelembapanAvg - movingAverageOf(priorWindow, "kelembapan")),
      ph: Math.abs(phAvg - movingAverageOf(priorWindow, "ph")),
    };
  }

  const isStable =
    rates !== null &&
    rates.suhu <= STABLE_RATE.suhu &&
    rates.kelembapan <= STABLE_RATE.kelembapan &&
    rates.ph <= STABLE_RATE.ph;

  const dataConfidenceBonus = Math.min(sorted.length / (windowSize * 2), 1) * 0.05;

  if (withinTarget && isStable) {
    return {
      status: ReadinessStatus.SIAP_STERILISASI,
      confidence: Math.min(0.9 + dataConfidenceBonus, 0.99),
      reasoning: `Suhu (${suhuAvg.toFixed(1)}°C), kelembapan (${kelembapanAvg.toFixed(1)}%), dan pH (${phAvg.toFixed(2)}) berada di rentang target dan stabil selama ${windowSize} pembacaan terakhir.`,
      anomaly: null,
    };
  }

  if (withinTarget) {
    return {
      status: ReadinessStatus.DALAM_PROSES,
      confidence: 0.6 + dataConfidenceBonus,
      reasoning: `Parameter sudah masuk rentang target (suhu ${suhuAvg.toFixed(1)}°C, kelembapan ${kelembapanAvg.toFixed(1)}%, pH ${phAvg.toFixed(2)}) tapi belum cukup lama stabil, masih menunggu konfirmasi.`,
      anomaly: null,
    };
  }

  const outOfRange: string[] = [];
  if (!inRange(suhuAvg, THRESHOLDS.suhu)) outOfRange.push(`suhu ${suhuAvg.toFixed(1)}°C`);
  if (!inRange(kelembapanAvg, THRESHOLDS.kelembapan)) outOfRange.push(`kelembapan ${kelembapanAvg.toFixed(1)}%`);
  if (!inRange(phAvg, THRESHOLDS.ph)) outOfRange.push(`pH ${phAvg.toFixed(2)}`);

  // Trennya masih bergerak (belum stabil) walau belum in-range penuh berarti
  // masih mendekati target -> "dalam proses". Kalau stabil tapi tetap di
  // luar target, atau datanya belum cukup untuk menilai tren -> "belum siap".
  const status = rates && !isStable ? ReadinessStatus.DALAM_PROSES : ReadinessStatus.BELUM_SIAP;

  return {
    status,
    confidence: 0.5 + dataConfidenceBonus,
    reasoning: `Masih di luar rentang target: ${outOfRange.join(", ")}.`,
    anomaly: null,
  };
}
