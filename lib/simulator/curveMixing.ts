export const DEFAULT_MIXING_DURATION_HOURS = 4;

export interface MixingPoint {
  pH: number;
  kekeruhanAir: number;
  beratKg: number;
}

/**
 * Kurva Smart Mixing realistis: bahan mentah asam & keruh rendah di awal
 * (limbah jagung segar) → mendekati netral & kekeruhan naik ke rentang target
 * seiring dedak+kapur ditambahkan (lihat PRD.md §7.5). `targetWeightKg` sama
 * dengan `MIXING_TARGET_TOTAL_WEIGHT_KG` di lib/ai/evaluateMixingReadiness.ts.
 */
export function baseMixingReadingAt(hourIntoProcess: number, totalHours: number, targetWeightKg = 100): MixingPoint {
  const progress = Math.min(Math.max(hourIntoProcess / totalHours, 0), 1);

  const pH = 5.0 + 1.5 * progress + (Math.random() - 0.5) * 0.08;
  const kekeruhanAir = 80 + 270 * progress + (Math.random() - 0.5) * 15;
  const beratKg = targetWeightKg * Math.min(progress * 1.05, 1);

  return {
    pH: Number(pH.toFixed(2)),
    kekeruhanAir: Number(kekeruhanAir.toFixed(1)),
    beratKg: Number(beratKg.toFixed(1)),
  };
}

export type MixingAnomalyType = "ph-shift" | "kekeruhan-drop";

/** Menyuntikkan satu titik anomali untuk keperluan testing alert. */
export function applyMixingAnomaly(point: MixingPoint, type: MixingAnomalyType): MixingPoint {
  if (type === "ph-shift") {
    return { ...point, pH: Number((point.pH + 1.3 + Math.random() * 0.4).toFixed(2)) };
  }
  return { ...point, kekeruhanAir: Number((point.kekeruhanAir - 100 - Math.random() * 30).toFixed(1)) };
}
