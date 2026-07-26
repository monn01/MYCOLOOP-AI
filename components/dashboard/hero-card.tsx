"use client";

import { useEffect, useState } from "react";
import { ReadinessStatus, type BatchStatus, type PipelineStage } from "@/lib/generated/prisma/enums";
import { BATCH_STATUS_STYLE, READINESS_STATUS_STYLE, getReadinessLabel } from "@/lib/ui/status-styles";
import { CheckCircleSolidIcon } from "@/components/ui/icons";

interface HeroCardProps {
  batchId: string;
  batchStatus: BatchStatus;
  stage: PipelineStage;
  decision: { status: ReadinessStatus; confidence: number; reasoning: string } | null;
  isLive: boolean;
  userName?: string;
}

/**
 * Rule-based, bukan model dengan progress linear — sengaja hanya kalimat
 * kualitatif per status, tanpa hitung mundur menit yang presisi palsu
 * (design.md §5.6: "jangan beri kesan presisi ML yang tidak ada").
 */
function readinessNote(status: ReadinessStatus): string {
  switch (status) {
    case ReadinessStatus.SIAP_STERILISASI:
      return "Sudah bisa diproses ke tahap berikutnya sekarang.";
    case ReadinessStatus.DALAM_PROSES:
      return "Parameter mendekati target, menunggu kestabilan.";
    case ReadinessStatus.BELUM_SIAP:
    default:
      return "Belum dapat diperkirakan.";
  }
}

function greetingForHour(hour: number): string {
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 19) return "Selamat Sore";
  return "Selamat Malam";
}

export function HeroCard({ batchId, batchStatus, stage, decision, isLive, userName }: HeroCardProps) {
  // Dihitung di client (useEffect) supaya tidak mismatch dengan waktu server saat SSR.
  const [greeting, setGreeting] = useState<string | null>(null);
  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  const batchStyle = BATCH_STATUS_STYLE[batchStatus];
  const readinessTone = decision ? READINESS_STATUS_STYLE[decision.status].tone : null;
  const readinessLabel = decision ? getReadinessLabel(decision.status, stage) : null;

  // Gradient hijau tegas untuk "safe" (§5.3 versi lebih hidup dari flat tint
  // sebelumnya) — caution/danger TETAP flat tint, tidak pernah gradient,
  // supaya sinyal bahaya tidak terkesan "didekorasi" (design.md §10).
  const containerClassName =
    readinessTone === "safe"
      ? "bg-gradient-to-br from-[var(--color-green-700)] to-[var(--color-green-900)] border-transparent text-white"
      : readinessTone === "progress"
        ? "bg-gradient-to-br from-white to-[var(--color-green-50)] border-status-progress-border"
        : readinessTone === "caution"
          ? "bg-status-caution-bg border-status-caution-border"
          : readinessTone === "danger"
            ? "bg-status-danger-bg border-status-danger-border"
            : "bg-status-neutral-bg border-status-neutral-border";

  const isDark = readinessTone === "safe";
  const mutedTextClassName = isDark ? "text-white/75" : "text-muted-foreground";
  const bodyTextClassName = isDark ? "text-white/90" : "text-card-foreground";

  return (
    <div className={`rounded-card border p-4 shadow-card lg:p-6 ${containerClassName}`}>
      {greeting && (
        <p className={`text-sm font-medium ${mutedTextClassName}`}>
          {greeting}{userName ? `, ${userName}!` : "!"}
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isDark ? "" : ""}`}>
          {batchStyle.pulse && <span className="h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden />}
          {batchStyle.label.toUpperCase()}
        </span>
        <span className={`text-xs ${mutedTextClassName}`}>
          Batch #{batchId.slice(0, 8)} {isLive ? "· live" : "· offline"}
        </span>
      </div>

      {decision && readinessLabel ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            {readinessTone === "safe" ? (
              <CheckCircleSolidIcon className="h-5 w-5" />
            ) : (
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" aria-hidden />
            )}
            <span className="text-lg font-semibold">{readinessLabel.toUpperCase()}</span>
            <span className={`text-sm font-medium ${mutedTextClassName}`}>
              conf. {Math.round(decision.confidence * 100)}%
            </span>
          </div>
          <p className={`mt-1.5 text-sm ${bodyTextClassName}`}>&ldquo;{decision.reasoning}&rdquo;</p>
        </div>
      ) : (
        <p className={`mt-3 text-sm ${mutedTextClassName}`}>Menunggu data sensor pertama masuk.</p>
      )}

      <p className={`mt-3 text-sm font-medium ${bodyTextClassName}`}>{decision ? readinessNote(decision.status) : ""}</p>
    </div>
  );
}
