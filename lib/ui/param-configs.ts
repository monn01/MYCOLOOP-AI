import { THRESHOLDS } from "@/lib/ai/evaluateReadiness";
import { MIXING_THRESHOLDS } from "@/lib/ai/evaluateMixingReadiness";
import { INCUBATION_THRESHOLDS } from "@/lib/ai/evaluateIncubationReadiness";
import { CHART_COLORS } from "@/lib/ui/chart-colors";

export interface ParamConfigEntry {
  label: string;
  unit: string;
  color: string;
  dash?: string;
  range: { min: number; max: number };
}

export type ParamConfig = Record<string, ParamConfigEntry>;

/** Smart Pre-Conditioning (PRD.md §7.2) — suhu/kelembapan chamber (pH pindah ke Mixing). */
export const PRE_CONDITIONING_PARAM_CONFIG: ParamConfig = {
  suhu: { label: "Suhu", unit: "°C", color: CHART_COLORS.green700, range: THRESHOLDS.suhu },
  kelembapan: { label: "Kelembapan", unit: "%", color: CHART_COLORS.green500, dash: "6 3", range: THRESHOLDS.kelembapan },
};

/** Smart Mixing (PRD.md §7.5) — pH, kekeruhan air, berat bahan. */
export const MIXING_PARAM_CONFIG: ParamConfig = {
  pH: { label: "pH", unit: "", color: CHART_COLORS.green700, range: MIXING_THRESHOLDS.pH },
  kekeruhanAir: { label: "Kekeruhan Air", unit: "NTU", color: CHART_COLORS.green500, dash: "6 3", range: MIXING_THRESHOLDS.kekeruhanAir },
};

/** Smart Incubation Monitoring (PRD.md §7.6) — suhu/kelembapan/CO2/cahaya ruang inkubasi. */
export const INCUBATION_PARAM_CONFIG: ParamConfig = {
  suhu: { label: "Suhu", unit: "°C", color: CHART_COLORS.green700, range: INCUBATION_THRESHOLDS.suhu },
  kelembapan: { label: "Kelembapan", unit: "%", color: CHART_COLORS.green500, dash: "6 3", range: INCUBATION_THRESHOLDS.kelembapan },
  co2: { label: "CO2", unit: "ppm", color: CHART_COLORS.green300, dash: "2 2", range: INCUBATION_THRESHOLDS.co2 },
  cahaya: { label: "Cahaya", unit: "lux", color: CHART_COLORS.sage600, dash: "1 3", range: INCUBATION_THRESHOLDS.cahaya },
};
