export const DEFAULT_INCUBATION_DURATION_HOURS = 14 * 24; // ~2 minggu kolonisasi

export interface IncubationPoint {
  suhu: number;
  kelembapan: number;
  co2: number;
  cahaya: number;
}

/**
 * Kurva Smart Incubation realistis: suhu/kelembapan/cahaya belum ideal &
 * CO2 masih rendah (miselium belum aktif) di awal → stabil di rentang target
 * menjelang siap panen. CO2 naik seiring waktu (bukan turun seperti
 * parameter lain) karena respirasi miselium meningkat selama kolonisasi
 * (lihat PRD.md §7.6).
 */
export function baseIncubationReadingAt(hourIntoProcess: number, totalHours: number): IncubationPoint {
  const progress = Math.min(Math.max(hourIntoProcess / totalHours, 0), 1);

  const suhu = 31 - 6 * progress + (Math.random() - 0.5) * 0.6;
  const kelembapan = 60 + 20 * progress + (Math.random() - 0.5) * 1.5;
  const co2 = 200 + 700 * progress + (Math.random() - 0.5) * 30;
  const cahaya = 110 - 95 * progress + (Math.random() - 0.5) * 3;

  return {
    suhu: Number(suhu.toFixed(2)),
    kelembapan: Number(kelembapan.toFixed(2)),
    co2: Number(co2.toFixed(0)),
    cahaya: Number(Math.max(cahaya, 0).toFixed(1)),
  };
}

export type IncubationAnomalyType = "suhu-spike" | "contamination-pattern";

/** Menyuntikkan satu titik anomali untuk keperluan testing alert. */
export function applyIncubationAnomaly(point: IncubationPoint, type: IncubationAnomalyType): IncubationPoint {
  if (type === "suhu-spike") {
    return { ...point, suhu: Number((point.suhu + 6 + Math.random() * 2).toFixed(2)) };
  }
  return {
    ...point,
    co2: Number((point.co2 + 450 + Math.random() * 100).toFixed(0)),
    kelembapan: Number((point.kelembapan - 10 - Math.random() * 3).toFixed(2)),
  };
}
