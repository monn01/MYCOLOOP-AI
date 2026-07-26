export const DEFAULT_MIXING_DURATION_HOURS = 4;

export interface MixingPoint {
  kadarAir: number;
  rasioCN: number;
  beratKg: number;
}

/**
 * Kurva Smart Mixing realistis: bahan baku mentah (kadar air & rasio C:N
 * tinggi) → homogen & di rentang target menjelang siap dipindah ke
 * Pre-Conditioning (lihat PRD.md §7.5). Proses jauh lebih singkat dari
 * pre-conditioning (jam, bukan hari) karena murni pencacahan+pencampuran.
 */
export function baseMixingReadingAt(hourIntoProcess: number, totalHours: number, targetWeightKg = 100): MixingPoint {
  const progress = Math.min(Math.max(hourIntoProcess / totalHours, 0), 1);

  const kadarAir = 72 - 17 * progress + (Math.random() - 0.5) * 1.2;
  const rasioCN = 46 - 16 * progress + (Math.random() - 0.5) * 0.8;
  const beratKg = targetWeightKg * Math.min(progress * 1.05, 1);

  return {
    kadarAir: Number(kadarAir.toFixed(2)),
    rasioCN: Number(rasioCN.toFixed(2)),
    beratKg: Number(beratKg.toFixed(1)),
  };
}

export type MixingAnomalyType = "kadar-air-drop" | "rasio-cn-shift";

/** Menyuntikkan satu titik anomali untuk keperluan testing alert. */
export function applyMixingAnomaly(point: MixingPoint, type: MixingAnomalyType): MixingPoint {
  if (type === "kadar-air-drop") {
    return { ...point, kadarAir: Number((point.kadarAir - 10 - Math.random() * 3).toFixed(2)) };
  }
  return { ...point, rasioCN: Number((point.rasioCN + 7 + Math.random() * 2).toFixed(2)) };
}
