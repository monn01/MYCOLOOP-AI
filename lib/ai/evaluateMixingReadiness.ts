import { ReadinessStatus } from "../generated/prisma/enums";

/**
 * Minimal shape dibutuhkan dari MixingReading. Sengaja tidak import tipe
 * generated Prisma — sama seperti pola di evaluateReadiness.ts, supaya logic
 * AI ini tidak terikat ke client Prisma yang di-generate ulang.
 */
export interface MixingReadingInput {
  timestamp: Date;
  kadarAir: number;
  rasioCN: number;
}

export const MIXING_THRESHOLDS = {
  kadarAir: { min: 50, max: 60 },
  rasioCN: { min: 25, max: 35 },
} as const;

const MOVING_AVERAGE_WINDOW = 5;

// Lonjakan/penurunan mendadak antar dua pembacaan berurutan.
const KADAR_AIR_DROP_DELTA = 8;
const RASIO_CN_SHIFT_DELTA = 5;

const STABLE_RATE = {
  kadarAir: 1.0,
  rasioCN: 0.8,
};

export type MixingAnomalyType = "KADAR_AIR_DROP" | "RASIO_CN_SHIFT";

export interface MixingAnomalyDetection {
  type: MixingAnomalyType;
  message: string;
}

export interface MixingAIDecisionResult {
  status: ReadinessStatus;
  confidence: number;
  reasoning: string;
  anomaly: MixingAnomalyDetection | null;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function movingAverageOf(points: MixingReadingInput[], key: "kadarAir" | "rasioCN"): number {
  return average(points.map((p) => p[key]));
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}

/**
 * Rule-based readiness classifier untuk Smart Mixing (lihat PRD.md §7.5).
 * "Siap" di sini berarti bahan baku siap dipindah ke Smart Pre-Conditioning,
 * bukan siap sterilisasi — label per-stage ditangani di lib/ui/status-styles.ts,
 * enum ReadinessStatus tetap dipakai bersama lintas stage.
 */
export function evaluateMixingReadiness(readings: MixingReadingInput[]): MixingAIDecisionResult {
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
    const kadarAirDelta = previous.kadarAir - latest.kadarAir;
    if (kadarAirDelta > KADAR_AIR_DROP_DELTA) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.85,
        reasoning: `Penurunan kadar air drastis terdeteksi: turun ${kadarAirDelta.toFixed(1)}% dari pembacaan sebelumnya (${previous.kadarAir}% → ${latest.kadarAir}%).`,
        anomaly: {
          type: "KADAR_AIR_DROP",
          message: `Kadar air turun ${kadarAirDelta.toFixed(1)}% dalam satu interval pembacaan (${previous.kadarAir}% → ${latest.kadarAir}%).`,
        },
      };
    }

    const rasioCNDelta = Math.abs(latest.rasioCN - previous.rasioCN);
    if (rasioCNDelta > RASIO_CN_SHIFT_DELTA) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.8,
        reasoning: `Perubahan rasio C:N drastis terdeteksi: bergeser ${rasioCNDelta.toFixed(1)} dari pembacaan sebelumnya (${previous.rasioCN} → ${latest.rasioCN}).`,
        anomaly: {
          type: "RASIO_CN_SHIFT",
          message: `Rasio C:N bergeser ${rasioCNDelta.toFixed(1)} dalam satu interval pembacaan (${previous.rasioCN} → ${latest.rasioCN}), periksa komposisi campuran.`,
        },
      };
    }
  }

  const windowSize = Math.min(MOVING_AVERAGE_WINDOW, sorted.length);
  const window = sorted.slice(-windowSize);

  const kadarAirAvg = movingAverageOf(window, "kadarAir");
  const rasioCNAvg = movingAverageOf(window, "rasioCN");

  const withinTarget = inRange(kadarAirAvg, MIXING_THRESHOLDS.kadarAir) && inRange(rasioCNAvg, MIXING_THRESHOLDS.rasioCN);

  let rates: { kadarAir: number; rasioCN: number } | null = null;
  if (sorted.length >= windowSize * 2) {
    const priorWindow = sorted.slice(-windowSize * 2, -windowSize);
    rates = {
      kadarAir: Math.abs(kadarAirAvg - movingAverageOf(priorWindow, "kadarAir")),
      rasioCN: Math.abs(rasioCNAvg - movingAverageOf(priorWindow, "rasioCN")),
    };
  }

  const isStable = rates !== null && rates.kadarAir <= STABLE_RATE.kadarAir && rates.rasioCN <= STABLE_RATE.rasioCN;

  const dataConfidenceBonus = Math.min(sorted.length / (windowSize * 2), 1) * 0.05;

  if (withinTarget && isStable) {
    return {
      status: ReadinessStatus.SIAP_STERILISASI,
      confidence: Math.min(0.9 + dataConfidenceBonus, 0.99),
      reasoning: `Kadar air (${kadarAirAvg.toFixed(1)}%) dan rasio C:N (${rasioCNAvg.toFixed(1)}) berada di rentang target dan stabil selama ${windowSize} pembacaan terakhir.`,
      anomaly: null,
    };
  }

  if (withinTarget) {
    return {
      status: ReadinessStatus.DALAM_PROSES,
      confidence: 0.6 + dataConfidenceBonus,
      reasoning: `Parameter sudah masuk rentang target (kadar air ${kadarAirAvg.toFixed(1)}%, rasio C:N ${rasioCNAvg.toFixed(1)}) tapi belum cukup lama stabil, masih menunggu konfirmasi.`,
      anomaly: null,
    };
  }

  const outOfRange: string[] = [];
  if (!inRange(kadarAirAvg, MIXING_THRESHOLDS.kadarAir)) outOfRange.push(`kadar air ${kadarAirAvg.toFixed(1)}%`);
  if (!inRange(rasioCNAvg, MIXING_THRESHOLDS.rasioCN)) outOfRange.push(`rasio C:N ${rasioCNAvg.toFixed(1)}`);

  const status = rates && !isStable ? ReadinessStatus.DALAM_PROSES : ReadinessStatus.BELUM_SIAP;

  return {
    status,
    confidence: 0.5 + dataConfidenceBonus,
    reasoning: `Masih di luar rentang target: ${outOfRange.join(", ")}.`,
    anomaly: null,
  };
}
