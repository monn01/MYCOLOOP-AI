import Link from "next/link";
import type { BatchStatus, PipelineStage } from "@/lib/generated/prisma/enums";
import { BATCH_STATUS_STYLE } from "@/lib/ui/status-styles";
import { formatDate, formatDuration } from "@/lib/ui/format";
import { ArrowRightIcon } from "@/components/ui/icons";

export interface BatchListItem {
  id: string;
  formula: string | null;
  startTime: string;
  endTime: string | null;
  status: BatchStatus;
  stage: PipelineStage;
}

interface BatchListProps {
  batches: BatchListItem[];
  /** Tampilkan kolom/badge stage — dipakai saat Riwayat menampilkan lintas-stage ("Semua"). */
  showStage?: boolean;
}

const STAGE_LABEL: Record<PipelineStage, string> = {
  MIXING: "Mixing",
  PRE_CONDITIONING: "Pre-Cond.",
  INCUBATION: "Inkubasi",
};

/**
 * Desktop: table. Mobile: card list (design.md §5.9 — tabel di-scroll
 * horizontal di mobile dilarang eksplisit).
 */
export function BatchList({ batches, showStage }: BatchListProps) {
  if (batches.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Belum ada riwayat batch.</p>;
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-background-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ID Batch</th>
              {showStage && <th className="px-4 py-3">Stage</th>}
              <th className="px-4 py-3">Substrat</th>
              <th className="px-4 py-3">Tanggal Mulai</th>
              <th className="px-4 py-3">Durasi</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const style = BATCH_STATUS_STYLE[batch.status];
              return (
                <tr key={batch.id} className="border-t border-border hover:bg-background-subtle">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{batch.id.slice(0, 8)}</td>
                  {showStage && (
                    <td className="px-4 py-3 text-xs text-muted-foreground">{STAGE_LABEL[batch.stage]}</td>
                  )}
                  <td className="max-w-[200px] truncate px-4 py-3">{batch.formula ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(batch.startTime)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDuration(batch.startTime, batch.endTime)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.badgeClassName}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/riwayat/${batch.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Detail <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {batches.map((batch) => {
          const style = BATCH_STATUS_STYLE[batch.status];
          return (
            <Link
              key={batch.id}
              href={`/riwayat/${batch.id}`}
              className="block rounded-card border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">#{batch.id.slice(0, 8)}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.badgeClassName}`}>
                  {style.label}
                </span>
              </div>
              <p className="mt-1.5 truncate text-sm font-medium text-card-foreground">{batch.formula ?? "—"}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {showStage ? `${STAGE_LABEL[batch.stage]} · ` : ""}
                  {formatDate(batch.startTime)}
                </span>
                <span>{formatDuration(batch.startTime, batch.endTime)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
