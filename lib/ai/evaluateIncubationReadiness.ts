import { ReadinessStatus } from "../generated/prisma/enums";

/**
 * Minimal shape dibutuhkan dari IncubationReading. Sengaja tidak import tipe
 * generated Prisma — sama seperti pola di evaluateReadiness.ts.
 */
export interface IncubationReadingInput {
  timestamp: Date;
  suhu: number;
  kelembapan: number;
  co2: number;
  cahaya: number;
}

/**
 * Threshold divalidasi riset literatur publik 2026-07-26 (lihat PRD.md §13):
 * - suhu, kelembapan: cocok literatur kolonisasi jamur tiram (22-24°C
 *   tercepat, kelembapan 70-90%) — tidak diubah, sumber ditambahkan sebagai
 *   dokumentasi.
 * - co2: dinaikkan dari 500-1500ppm ke 500-5000ppm. Literatur bilang CO2
 *   normal selama kolonisasi/spawn run jauh lebih tinggi dari target fase
 *   fruiting (500-1000ppm) — 5000ppm dipakai sebagai batas atas karena itu
 *   angka toleransi mycelium yang eksplisit disebut sumber, bukan angka
 *   kantong tertutup individual (10.000-20.000ppm) yang levelnya beda dari
 *   sensor ruangan MYCOLOOP-AI. Masih ada ambiguitas residual: belum
 *   dikonfirmasi apakah sensor fisik nanti benar-benar di level ruangan
 *   (asumsi ini) atau lebih dekat ke baglog individual — kalibrasi ulang
 *   di Phase 6 tetap perlu begitu data sensor asli ada.
 */
export const INCUBATION_THRESHOLDS = {
  suhu: { min: 22, max: 28 },
  kelembapan: { min: 70, max: 90 },
  co2: { min: 500, max: 5000 },
  cahaya: { min: 0, max: 50 },
} as const;

const MOVING_AVERAGE_WINDOW = 5;

const SUHU_SPIKE_DELTA = 5;
// Pola kontaminasi (bukan sekadar anomali tunggal): lonjakan CO2 bersamaan
// KENAIKAN kelembapan dalam interval yang sama — indikasi sirkulasi udara
// buruk/kondisi stagnan yang jadi microclimate favorit kontaminan (lihat
// PRD.md §7.6/§13). Arah kelembapan direvisi 2026-07-26 dari "turun" jadi
// "naik" berdasar riset: literatur Trichoderma (kontaminan hijau paling
// umum) konsisten menyebut kondisi berisiko itu CO2 tinggi + kelembapan
// TINGGI bersamaan (stagnan/lembap/hangat), bukan kelembapan turun — versi
// lama tidak ditemukan dasar literaturnya. Ini pengganti rule-based untuk
// "AI Vision" deteksi kontaminasi di MVP, bukan computer vision sungguhan
// (lihat catatan roadmap ML di PRD.md §7).
const CO2_SPIKE_DELTA = 400;
const KELEMBAPAN_RISE_DELTA = 8;

const STABLE_RATE = {
  suhu: 0.5,
  kelembapan: 1.5,
  co2: 60,
  cahaya: 3,
};

export type IncubationAnomalyType = "SUHU_SPIKE" | "CONTAMINATION_PATTERN";

export interface IncubationAnomalyDetection {
  type: IncubationAnomalyType;
  message: string;
  /** true kalau ini indikasi kontaminasi (dipetakan ke Alert.type CONTAMINATION), bukan anomali sensor biasa. */
  isContamination: boolean;
}

export interface IncubationAIDecisionResult {
  status: ReadinessStatus;
  confidence: number;
  reasoning: string;
  anomaly: IncubationAnomalyDetection | null;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function movingAverageOf(
  points: IncubationReadingInput[],
  key: "suhu" | "kelembapan" | "co2" | "cahaya"
): number {
  return average(points.map((p) => p[key]));
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}

/**
 * Rule-based readiness classifier untuk Smart Incubation Monitoring (lihat
 * PRD.md §7.6). "Siap" di sini berarti miselium tumbuh optimal & stabil,
 * siap masuk fase pembentukan pinhead/panen.
 */
export function evaluateIncubationReadiness(readings: IncubationReadingInput[]): IncubationAIDecisionResult {
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
    const co2Delta = latest.co2 - previous.co2;
    const kelembapanDelta = latest.kelembapan - previous.kelembapan;

    if (co2Delta > CO2_SPIKE_DELTA && kelembapanDelta > KELEMBAPAN_RISE_DELTA) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.8,
        reasoning: `Pola tidak wajar terdeteksi: CO2 naik ${co2Delta.toFixed(0)}ppm bersamaan kelembapan naik ${kelembapanDelta.toFixed(1)}%, indikasi sirkulasi udara buruk/kondisi stagnan berisiko kontaminasi.`,
        anomaly: {
          type: "CONTAMINATION_PATTERN",
          message: `CO2 melonjak ${co2Delta.toFixed(0)}ppm (${previous.co2} → ${latest.co2}) bersamaan kelembapan naik ${kelembapanDelta.toFixed(1)}% (${previous.kelembapan}% → ${latest.kelembapan}%), indikasi sirkulasi udara buruk. Segera periksa baglog secara visual.`,
          isContamination: true,
        },
      };
    }

    const suhuDelta = latest.suhu - previous.suhu;
    if (suhuDelta > SUHU_SPIKE_DELTA) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.85,
        reasoning: `Lonjakan suhu terdeteksi: naik ${suhuDelta.toFixed(1)}°C dari pembacaan sebelumnya (${previous.suhu}°C → ${latest.suhu}°C).`,
        anomaly: {
          type: "SUHU_SPIKE",
          message: `Suhu ruang inkubasi melonjak ${suhuDelta.toFixed(1)}°C dalam satu interval pembacaan (${previous.suhu}°C → ${latest.suhu}°C).`,
          isContamination: false,
        },
      };
    }
  }

  const windowSize = Math.min(MOVING_AVERAGE_WINDOW, sorted.length);
  const window = sorted.slice(-windowSize);

  const suhuAvg = movingAverageOf(window, "suhu");
  const kelembapanAvg = movingAverageOf(window, "kelembapan");
  const co2Avg = movingAverageOf(window, "co2");
  const cahayaAvg = movingAverageOf(window, "cahaya");

  const withinTarget =
    inRange(suhuAvg, INCUBATION_THRESHOLDS.suhu) &&
    inRange(kelembapanAvg, INCUBATION_THRESHOLDS.kelembapan) &&
    inRange(co2Avg, INCUBATION_THRESHOLDS.co2) &&
    inRange(cahayaAvg, INCUBATION_THRESHOLDS.cahaya);

  let rates: { suhu: number; kelembapan: number; co2: number; cahaya: number } | null = null;
  if (sorted.length >= windowSize * 2) {
    const priorWindow = sorted.slice(-windowSize * 2, -windowSize);
    rates = {
      suhu: Math.abs(suhuAvg - movingAverageOf(priorWindow, "suhu")),
      kelembapan: Math.abs(kelembapanAvg - movingAverageOf(priorWindow, "kelembapan")),
      co2: Math.abs(co2Avg - movingAverageOf(priorWindow, "co2")),
      cahaya: Math.abs(cahayaAvg - movingAverageOf(priorWindow, "cahaya")),
    };
  }

  const isStable =
    rates !== null &&
    rates.suhu <= STABLE_RATE.suhu &&
    rates.kelembapan <= STABLE_RATE.kelembapan &&
    rates.co2 <= STABLE_RATE.co2 &&
    rates.cahaya <= STABLE_RATE.cahaya;

  const dataConfidenceBonus = Math.min(sorted.length / (windowSize * 2), 1) * 0.05;

  if (withinTarget && isStable) {
    return {
      status: ReadinessStatus.SIAP_STERILISASI,
      confidence: Math.min(0.9 + dataConfidenceBonus, 0.99),
      reasoning: `Suhu (${suhuAvg.toFixed(1)}°C), kelembapan (${kelembapanAvg.toFixed(1)}%), CO2 (${co2Avg.toFixed(0)}ppm), dan cahaya (${cahayaAvg.toFixed(0)}lux) berada di rentang target dan stabil selama ${windowSize} pembacaan terakhir — miselium tumbuh optimal.`,
      anomaly: null,
    };
  }

  if (withinTarget) {
    return {
      status: ReadinessStatus.DALAM_PROSES,
      confidence: 0.6 + dataConfidenceBonus,
      reasoning: `Parameter sudah masuk rentang target tapi belum cukup lama stabil, miselium masih dalam masa pertumbuhan.`,
      anomaly: null,
    };
  }

  const outOfRange: string[] = [];
  if (!inRange(suhuAvg, INCUBATION_THRESHOLDS.suhu)) outOfRange.push(`suhu ${suhuAvg.toFixed(1)}°C`);
  if (!inRange(kelembapanAvg, INCUBATION_THRESHOLDS.kelembapan)) outOfRange.push(`kelembapan ${kelembapanAvg.toFixed(1)}%`);
  if (!inRange(co2Avg, INCUBATION_THRESHOLDS.co2)) outOfRange.push(`CO2 ${co2Avg.toFixed(0)}ppm`);
  if (!inRange(cahayaAvg, INCUBATION_THRESHOLDS.cahaya)) outOfRange.push(`cahaya ${cahayaAvg.toFixed(0)}lux`);

  const status = rates && !isStable ? ReadinessStatus.DALAM_PROSES : ReadinessStatus.BELUM_SIAP;

  return {
    status,
    confidence: 0.5 + dataConfidenceBonus,
    reasoning: `Masih di luar rentang target: ${outOfRange.join(", ")}.`,
    anomaly: null,
  };
}
