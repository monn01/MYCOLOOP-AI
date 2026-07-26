import { AlertType, BatchStatus, PipelineStage, ReadinessStatus } from "@/lib/generated/prisma/enums";

/**
 * Satu sumber kebenaran untuk memetakan enum Prisma ke bahasa visual
 * (design.md §4.2 dan §9). Jangan hardcode warna/label status di komponen —
 * selalu lewat mapping di sini supaya konsisten di semua halaman.
 */

export type StatusTone = "safe" | "progress" | "caution" | "danger" | "neutral";

interface StatusStyle {
  label: string;
  tone: StatusTone;
  /** Kelas badge: bg tint + teks + border, siap pakai di <span>. */
  badgeClassName: string;
  /** true = pakai dot berdenyut (animate-pulse), false = ikon statis (lihat components/ui/icons.tsx). */
  pulse: boolean;
}

const TONE_BADGE_CLASSNAME: Record<StatusTone, string> = {
  safe: "bg-status-safe-bg text-status-safe border-status-safe-border",
  progress: "bg-status-progress-bg text-status-progress border-status-progress-border",
  caution: "bg-status-caution-bg text-status-caution border-status-caution-border",
  danger: "bg-status-danger-bg text-status-danger border-status-danger-border",
  neutral: "bg-status-neutral-bg text-status-neutral border-status-neutral-border",
};

export const BATCH_STATUS_STYLE: Record<BatchStatus, StatusStyle> = {
  RUNNING: { label: "Berjalan", tone: "progress", badgeClassName: TONE_BADGE_CLASSNAME.progress, pulse: true },
  READY: { label: "Siap Sterilisasi", tone: "safe", badgeClassName: TONE_BADGE_CLASSNAME.safe, pulse: false },
  COMPLETED: { label: "Selesai", tone: "neutral", badgeClassName: TONE_BADGE_CLASSNAME.neutral, pulse: false },
  ABORTED: { label: "Dibatalkan", tone: "danger", badgeClassName: TONE_BADGE_CLASSNAME.danger, pulse: false },
};

/**
 * `label` di sini adalah default (rasa Pre-Conditioning) — dipakai kalau
 * konteks stage tidak tersedia. Untuk copy per-stage yang benar (mis. "Siap
 * Dipindahkan" untuk Mixing, "Siap Panen" untuk Incubation), pakai
 * `getReadinessLabel(status, stage)` di bawah. `tone`/`badgeClassName`/`pulse`
 * tetap sama lintas stage — cuma teksnya yang beda.
 */
export const READINESS_STATUS_STYLE: Record<ReadinessStatus, StatusStyle> = {
  BELUM_SIAP: { label: "Belum Siap", tone: "caution", badgeClassName: TONE_BADGE_CLASSNAME.caution, pulse: false },
  DALAM_PROSES: { label: "Dalam Proses", tone: "progress", badgeClassName: TONE_BADGE_CLASSNAME.progress, pulse: true },
  SIAP_STERILISASI: { label: "Siap Sterilisasi", tone: "safe", badgeClassName: TONE_BADGE_CLASSNAME.safe, pulse: false },
};

/**
 * ReadinessStatus dipakai bersama lintas 3 stage (lihat prisma/schema.prisma
 * komentar PipelineStage) supaya tidak perlu enum/model terpisah per stage —
 * tapi "siap" artinya beda tiap stage, jadi copy-nya di-map di sini saja,
 * bukan lewat rename enum value (hindari migrasi berisiko terhadap data yang sudah ada).
 */
const READINESS_LABEL_BY_STAGE: Record<PipelineStage, Record<ReadinessStatus, string>> = {
  MIXING: {
    BELUM_SIAP: "Belum Siap",
    DALAM_PROSES: "Dalam Proses",
    SIAP_STERILISASI: "Siap Dipindahkan",
  },
  PRE_CONDITIONING: {
    BELUM_SIAP: "Belum Siap",
    DALAM_PROSES: "Dalam Proses",
    SIAP_STERILISASI: "Siap Sterilisasi",
  },
  INCUBATION: {
    BELUM_SIAP: "Belum Siap",
    DALAM_PROSES: "Dalam Proses",
    SIAP_STERILISASI: "Siap Panen",
  },
};

export function getReadinessLabel(status: ReadinessStatus, stage: PipelineStage): string {
  return READINESS_LABEL_BY_STAGE[stage][status];
}

export const ALERT_TYPE_STYLE: Record<AlertType, StatusStyle> = {
  ANOMALY: { label: "Anomali", tone: "danger", badgeClassName: TONE_BADGE_CLASSNAME.danger, pulse: false },
  READY: { label: "Media Siap", tone: "safe", badgeClassName: TONE_BADGE_CLASSNAME.safe, pulse: false },
  CONTAMINATION: { label: "Kontaminasi", tone: "danger", badgeClassName: TONE_BADGE_CLASSNAME.danger, pulse: false },
};

/** Zona sensor terhadap threshold (design.md §4.2), dipakai di MetricCard & SensorChart. */
export type SensorZone = "safe" | "caution" | "danger";

export function sensorZone(value: number, range: { min: number; max: number }): SensorZone {
  if (value >= range.min && value <= range.max) return "safe";

  const span = range.max - range.min;
  const margin = span * 0.1;
  if (value >= range.min - margin && value <= range.max + margin) return "caution";

  return "danger";
}

export const SENSOR_ZONE_TEXT_CLASSNAME: Record<SensorZone, string> = {
  safe: "text-foreground",
  caution: "text-status-caution",
  danger: "text-status-danger",
};

export const SENSOR_ZONE_DOT_CLASSNAME: Record<SensorZone, string> = {
  safe: "bg-status-safe",
  caution: "bg-status-caution",
  danger: "bg-status-danger",
};
