import { ReadinessStatus } from "../generated/prisma/enums";

/**
 * Minimal shape dibutuhkan dari MixingReading. Sengaja tidak import tipe
 * generated Prisma — sama seperti pola di evaluateReadiness.ts, supaya logic
 * AI ini tidak terikat ke client Prisma yang di-generate ulang.
 */
export interface MixingReadingInput {
  timestamp: Date;
  pH: number;
  kekeruhanAir: number;
  beratKg: number;
}

/**
 * Divalidasi riset literatur publik 2026-07-26 (lihat PRD.md §13):
 * - pH: 6.0-7.0 cocok persis dengan formula baglog Indonesia (Cybex Kementan)
 *   dan studi komposisi Pleurotus ostreatus internasional — tidak diubah.
 * - kekeruhanAir: MASIH PLACEHOLDER, sengaja tidak diubah — riset literatur
 *   compost leachate turbidity ternyata sangat bervariasi tergantung bahan
 *   baku (27-3618 NTU di studi berbeda-beda), tidak ada korelasi baku
 *   "kekeruhan X NTU = kelembapan Y%" yang ditemukan. Dipakai sebagai proxy
 *   kelembapan/homogenitas campuran (makin keruh air rendaman/leachate =
 *   makin banyak partikel organik terlarut), tapi angka 200-500 NTU murni
 *   tebakan kasar — kalibrasi empiris di TASKPLAN.md Phase 6 jauh lebih
 *   penting di sini dibanding parameter lain.
 */
export const MIXING_THRESHOLDS = {
  pH: { min: 6.0, max: 7.0 },
  kekeruhanAir: { min: 200, max: 500 },
} as const;

/** Target berat total satu batch campuran (kg) — placeholder, sama dengan
 * default `targetWeightKg` di lib/simulator/curveMixing.ts. */
export const MIXING_TARGET_TOTAL_WEIGHT_KG = 100;

export interface MixingChannel {
  /** Dipakai sebagai `ActuatorCommand.target` = `valve:<name>`. */
  name: string;
  label: string;
  /** Fraksi dari MIXING_TARGET_TOTAL_WEIGHT_KG yang jadi kontribusi channel ini. */
  targetFraction: number;
}

/** PLACEHOLDER — 3 saluran bahan dengan rasio umum baglog jamur tiram
 * (limbah jagung dominan + dedak sebagai nutrisi + kapur buffer pH). */
export const MIXING_CHANNELS: MixingChannel[] = [
  { name: "limbah_jagung", label: "Limbah Jagung", targetFraction: 0.7 },
  { name: "dedak", label: "Dedak", targetFraction: 0.2 },
  { name: "kapur", label: "Kapur", targetFraction: 0.1 },
];

const MOVING_AVERAGE_WINDOW = 5;

// Lonjakan/penurunan mendadak antar dua pembacaan berurutan.
const PH_SHIFT_DELTA = 1.0;
const KEKERUHAN_DROP_DELTA = 80;

const STABLE_RATE = {
  pH: 0.15,
  kekeruhanAir: 15,
};

export type MixingAnomalyType = "PH_SHIFT" | "KEKERUHAN_DROP" | "WEIGHT_ANOMALY";

export interface MixingAnomalyDetection {
  type: MixingAnomalyType;
  message: string;
}

export type ValveState = "OPEN" | "CLOSED";

export interface MixingAIDecisionResult {
  status: ReadinessStatus;
  confidence: number;
  reasoning: string;
  anomaly: MixingAnomalyDetection | null;
  /** Posisi valve yang seharusnya SEKARANG, satu entry per MIXING_CHANNELS.
   * Diff-kan dengan command terakhir yang tersimpan oleh caller (lihat
   * lib/sensors/ingestMixing.ts) sebelum benar-benar dieksekusi ke aktuator. */
  desiredValveState: Record<string, ValveState>;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function movingAverageOf(points: MixingReadingInput[], key: "pH" | "kekeruhanAir"): number {
  return average(points.map((p) => p[key]));
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}

function allValvesClosed(): Record<string, ValveState> {
  return Object.fromEntries(MIXING_CHANNELS.map((c) => [c.name, "CLOSED" as ValveState]));
}

function singleValveOpen(name: string): Record<string, ValveState> {
  return Object.fromEntries(MIXING_CHANNELS.map((c) => [c.name, (c.name === name ? "OPEN" : "CLOSED") as ValveState]));
}

/** Channel yang seharusnya aktif berdasarkan berat kumulatif saat ini. */
function activeChannelFor(weightKg: number): MixingChannel | null {
  let cumulativeFraction = 0;
  for (const channel of MIXING_CHANNELS) {
    cumulativeFraction += channel.targetFraction;
    if (weightKg < cumulativeFraction * MIXING_TARGET_TOTAL_WEIGHT_KG) {
      return channel;
    }
  }
  return null; // semua channel sudah mencapai target beratnya
}

/**
 * Mixing Control Agent (lihat PRD.md §7.5) — rule-based state machine yang
 * mengurutkan buka/tutup valve per saluran bahan berdasar berat kumulatif,
 * lalu pakai pH/kekeruhan air sebagai gate kualitas begitu berat target
 * tercapai. "Siap" berarti bahan baku siap dipindah ke Smart Pre-Conditioning
 * — label per-stage ditangani di lib/ui/status-styles.ts, enum ReadinessStatus
 * tetap dipakai bersama lintas stage. `desiredValveState` HANYA rekomendasi
 * mentah; safety envelope (lib/ai/actuatorSafetyEnvelope.ts) yang memutuskan
 * apakah command benar-benar dieksekusi.
 */
export function evaluateMixingReadiness(readings: MixingReadingInput[]): MixingAIDecisionResult {
  if (readings.length === 0) {
    return {
      status: ReadinessStatus.BELUM_SIAP,
      confidence: 0,
      reasoning: "Belum ada data sensor untuk dievaluasi.",
      anomaly: null,
      desiredValveState: allValvesClosed(),
    };
  }

  const sorted = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  if (previous) {
    // Berat tidak boleh turun selama pengisian (proses aditif) — indikasi
    // sensor timbangan error, bukan pola fisik yang mungkin. Fail-safe: tutup
    // semua valve, jangan bertindak berdasarkan data yang tidak masuk akal.
    if (latest.beratKg < previous.beratKg) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.85,
        reasoning: `Berat menurun dari pembacaan sebelumnya (${previous.beratKg}kg → ${latest.beratKg}kg) — kemungkinan sensor timbangan error, semua valve ditutup untuk keamanan.`,
        anomaly: {
          type: "WEIGHT_ANOMALY",
          message: `Berat bahan turun dari ${previous.beratKg}kg ke ${latest.beratKg}kg, periksa sensor timbangan.`,
        },
        desiredValveState: allValvesClosed(),
      };
    }

    const phDelta = Math.abs(latest.pH - previous.pH);
    if (phDelta > PH_SHIFT_DELTA) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.85,
        reasoning: `Perubahan pH drastis terdeteksi: bergeser ${phDelta.toFixed(2)} dari pembacaan sebelumnya (${previous.pH} → ${latest.pH}), semua valve dijeda untuk verifikasi.`,
        anomaly: {
          type: "PH_SHIFT",
          message: `pH bergeser ${phDelta.toFixed(2)} dalam satu interval pembacaan (${previous.pH} → ${latest.pH}).`,
        },
        desiredValveState: allValvesClosed(),
      };
    }

    const kekeruhanDelta = previous.kekeruhanAir - latest.kekeruhanAir;
    if (kekeruhanDelta > KEKERUHAN_DROP_DELTA) {
      return {
        status: ReadinessStatus.BELUM_SIAP,
        confidence: 0.8,
        reasoning: `Penurunan kekeruhan air drastis terdeteksi: turun ${kekeruhanDelta.toFixed(0)} NTU dari pembacaan sebelumnya (${previous.kekeruhanAir} → ${latest.kekeruhanAir} NTU), semua valve dijeda untuk verifikasi.`,
        anomaly: {
          type: "KEKERUHAN_DROP",
          message: `Kekeruhan air turun ${kekeruhanDelta.toFixed(0)} NTU dalam satu interval pembacaan (${previous.kekeruhanAir} → ${latest.kekeruhanAir} NTU), periksa homogenitas campuran.`,
        },
        desiredValveState: allValvesClosed(),
      };
    }
  }

  const activeChannel = activeChannelFor(latest.beratKg);

  // Masih ada channel yang belum mencapai target berat -> buka valve-nya,
  // tutup yang lain. Belum masuk fase quality-gate.
  if (activeChannel) {
    return {
      status: latest.beratKg > 0 ? ReadinessStatus.DALAM_PROSES : ReadinessStatus.BELUM_SIAP,
      confidence: 0.6,
      reasoning: `Mengisi saluran ${activeChannel.label}: berat total ${latest.beratKg.toFixed(1)}kg dari target ${MIXING_TARGET_TOTAL_WEIGHT_KG}kg.`,
      anomaly: null,
      desiredValveState: singleValveOpen(activeChannel.name),
    };
  }

  // Semua channel sudah mencapai target berat -> fase quality-gate: cek
  // pH & kekeruhan air, koreksi lewat valve terkait kalau masih di luar target.
  const windowSize = Math.min(MOVING_AVERAGE_WINDOW, sorted.length);
  const window = sorted.slice(-windowSize);

  const phAvg = movingAverageOf(window, "pH");
  const kekeruhanAvg = movingAverageOf(window, "kekeruhanAir");

  const phOk = inRange(phAvg, MIXING_THRESHOLDS.pH);
  const kekeruhanOk = inRange(kekeruhanAvg, MIXING_THRESHOLDS.kekeruhanAir);

  let rates: { pH: number; kekeruhanAir: number } | null = null;
  if (sorted.length >= windowSize * 2) {
    const priorWindow = sorted.slice(-windowSize * 2, -windowSize);
    rates = {
      pH: Math.abs(phAvg - movingAverageOf(priorWindow, "pH")),
      kekeruhanAir: Math.abs(kekeruhanAvg - movingAverageOf(priorWindow, "kekeruhanAir")),
    };
  }

  const isStable = rates !== null && rates.pH <= STABLE_RATE.pH && rates.kekeruhanAir <= STABLE_RATE.kekeruhanAir;
  const dataConfidenceBonus = Math.min(sorted.length / (windowSize * 2), 1) * 0.05;

  if (phOk && kekeruhanOk && isStable) {
    return {
      status: ReadinessStatus.SIAP_STERILISASI,
      confidence: Math.min(0.9 + dataConfidenceBonus, 0.99),
      reasoning: `Formula tercampur: berat ${latest.beratKg.toFixed(1)}kg, pH (${phAvg.toFixed(2)}) dan kekeruhan air (${kekeruhanAvg.toFixed(0)} NTU) di rentang target dan stabil — siap dipindahkan ke Smart Pre-Conditioning.`,
      anomaly: null,
      desiredValveState: allValvesClosed(),
    };
  }

  if (phOk && kekeruhanOk) {
    return {
      status: ReadinessStatus.DALAM_PROSES,
      confidence: 0.6 + dataConfidenceBonus,
      reasoning: `pH (${phAvg.toFixed(2)}) dan kekeruhan air (${kekeruhanAvg.toFixed(0)} NTU) sudah masuk rentang target tapi belum cukup lama stabil, menunggu konfirmasi.`,
      anomaly: null,
      desiredValveState: allValvesClosed(),
    };
  }

  // Koreksi: pH rendah/rasio belum pas -> buka kapur (buffer pH); kekeruhan
  // di luar target -> buka limbah jagung (tambah materi/kelembapan). Kalau
  // dua-duanya di luar target, prioritaskan koreksi pH dulu (kapur).
  if (!phOk) {
    return {
      status: ReadinessStatus.DALAM_PROSES,
      confidence: 0.55 + dataConfidenceBonus,
      reasoning: `pH (${phAvg.toFixed(2)}) di luar rentang target (${MIXING_THRESHOLDS.pH.min}-${MIXING_THRESHOLDS.pH.max}), membuka valve kapur untuk koreksi.`,
      anomaly: null,
      desiredValveState: singleValveOpen("kapur"),
    };
  }

  return {
    status: ReadinessStatus.DALAM_PROSES,
    confidence: 0.55 + dataConfidenceBonus,
    reasoning: `Kekeruhan air (${kekeruhanAvg.toFixed(0)} NTU) di luar rentang target (${MIXING_THRESHOLDS.kekeruhanAir.min}-${MIXING_THRESHOLDS.kekeruhanAir.max}), membuka valve limbah jagung untuk koreksi.`,
    anomaly: null,
    desiredValveState: singleValveOpen("limbah_jagung"),
  };
}
