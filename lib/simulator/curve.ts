export const DEFAULT_DURATION_HOURS = 48;

export interface SensorPoint {
  suhu: number;
  kelembapan: number;
}

/**
 * Kurva pre-conditioning realistis: basah & panas di awal, menurun & stabil
 * menjelang siap sterilisasi (lihat PRD.md #2). `hourIntoProcess` boleh
 * melebihi `totalHours` — progress akan di-clamp ke kondisi stabil akhir.
 * pH pindah ke Mixing sejak pivot arsitektur 2026-07-26 (lihat PRD.md §1.1).
 */
export function baseReadingAt(hourIntoProcess: number, totalHours: number): SensorPoint {
  const progress = Math.min(Math.max(hourIntoProcess / totalHours, 0), 1);

  const suhu = 38 - 8 * progress + (Math.random() - 0.5) * 0.8;
  const kelembapan = 75 - 12 * progress + (Math.random() - 0.5) * 1.5;

  return {
    suhu: Number(suhu.toFixed(2)),
    kelembapan: Number(kelembapan.toFixed(2)),
  };
}

export type AnomalyType = "suhu-spike";

/** Menyuntikkan satu titik anomali untuk keperluan testing alert (PRD.md #7.3). */
export function applyAnomaly(point: SensorPoint, type: AnomalyType): SensorPoint {
  void type; // satu-satunya jenis anomali saat ini
  return { ...point, suhu: Number((point.suhu + 9 + Math.random() * 3).toFixed(2)) };
}
