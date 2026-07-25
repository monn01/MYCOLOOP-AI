export const DEFAULT_DURATION_HOURS = 48;

export interface SensorPoint {
  suhu: number;
  kelembapan: number;
  ph: number;
}

/**
 * Kurva pre-conditioning realistis: basah & panas di awal, menurun & stabil
 * menjelang siap sterilisasi (lihat PRD.md #2). `hourIntoProcess` boleh
 * melebihi `totalHours` — progress akan di-clamp ke kondisi stabil akhir.
 */
export function baseReadingAt(hourIntoProcess: number, totalHours: number): SensorPoint {
  const progress = Math.min(Math.max(hourIntoProcess / totalHours, 0), 1);

  const suhu = 38 - 8 * progress + (Math.random() - 0.5) * 0.8;
  const kelembapan = 75 - 12 * progress + (Math.random() - 0.5) * 1.5;
  const ph = 5.4 + 1.4 * progress + (Math.random() - 0.5) * 0.1;

  return {
    suhu: Number(suhu.toFixed(2)),
    kelembapan: Number(kelembapan.toFixed(2)),
    ph: Number(ph.toFixed(2)),
  };
}

export type AnomalyType = "suhu-spike" | "ph-drop";

/** Menyuntikkan satu titik anomali untuk keperluan testing alert (PRD.md #7.3). */
export function applyAnomaly(point: SensorPoint, type: AnomalyType): SensorPoint {
  if (type === "suhu-spike") {
    return { ...point, suhu: Number((point.suhu + 9 + Math.random() * 3).toFixed(2)) };
  }
  return { ...point, ph: Number((point.ph - 1.8 - Math.random() * 0.5).toFixed(2)) };
}
