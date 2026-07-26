import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { BatchStatus, PipelineStage } from "@/lib/generated/prisma/enums";
import { StatTile } from "@/components/dashboard/stat-tile";
import { BatchList } from "@/components/dashboard/batch-list";
import { formatDurationMs } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

const TABS: { label: string; stage?: PipelineStage }[] = [
  { label: "Semua" },
  { label: "Smart Mixing", stage: PipelineStage.MIXING },
  { label: "Pre-Conditioning", stage: PipelineStage.PRE_CONDITIONING },
  { label: "Smart Incubation", stage: PipelineStage.INCUBATION },
];

async function getRiwayatData(stage: PipelineStage | undefined, q: string | undefined) {
  const where = {
    ...(stage ? { stage } : {}),
    ...(q
      ? {
          OR: [
            { formula: { contains: q, mode: "insensitive" as const } },
            { id: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [batches, totalBatches, completedCount, abortedCount, batchesThisMonth, completedBatches] = await Promise.all([
    prisma.batch.findMany({
      where,
      orderBy: { startTime: "desc" },
      take: 50,
      select: { id: true, formula: true, startTime: true, endTime: true, status: true, stage: true },
    }),
    prisma.batch.count({ where }),
    prisma.batch.count({ where: { ...where, status: BatchStatus.COMPLETED } }),
    prisma.batch.count({ where: { ...where, status: BatchStatus.ABORTED } }),
    prisma.batch.count({ where: { ...where, startTime: { gte: startOfMonth } } }),
    prisma.batch.findMany({
      where: { ...where, status: BatchStatus.COMPLETED, endTime: { not: null } },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const finishedCount = completedCount + abortedCount;
  const successRate = finishedCount > 0 ? Math.round((completedCount / finishedCount) * 100) : null;

  const avgDurationMs =
    completedBatches.length > 0
      ? completedBatches.reduce((sum, b) => sum + (b.endTime!.getTime() - b.startTime.getTime()), 0) /
        completedBatches.length
      : null;

  return {
    batches: batches.map((b) => ({
      ...b,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime?.toISOString() ?? null,
    })),
    totalBatches,
    successRate,
    avgDurationMs,
    batchesThisMonth,
  };
}

interface RiwayatPageProps {
  searchParams: { stage?: string; q?: string };
}

function isPipelineStage(value: string | undefined): value is PipelineStage {
  return value === PipelineStage.MIXING || value === PipelineStage.PRE_CONDITIONING || value === PipelineStage.INCUBATION;
}

export default async function RiwayatPage({ searchParams }: RiwayatPageProps) {
  const activeStage = isPipelineStage(searchParams.stage) ? searchParams.stage : undefined;
  const q = searchParams.q?.trim() || undefined;

  const { batches, totalBatches, successRate, avgDurationMs, batchesThisMonth } = await getRiwayatData(activeStage, q);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.stage === activeStage;
          const href = tab.stage ? `/riwayat?stage=${tab.stage}` : "/riwayat";
          return (
            <Link
              key={tab.label}
              href={href}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {q && (
        <p className="text-sm text-muted-foreground">
          Menampilkan hasil pencarian untuk &ldquo;{q}&rdquo; —{" "}
          <Link href={activeStage ? `/riwayat?stage=${activeStage}` : "/riwayat"} className="text-primary hover:underline">
            hapus pencarian
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total Batch" value={String(totalBatches)} />
        <StatTile
          label="Tingkat Keberhasilan"
          value={successRate === null ? "—" : `${successRate}%`}
          positive={successRate !== null && successRate > 80}
        />
        <StatTile label="Rata-rata Durasi" value={avgDurationMs === null ? "—" : formatDurationMs(avgDurationMs)} />
        <StatTile label="Batch Bulan Ini" value={String(batchesThisMonth)} />
      </div>

      <BatchList batches={batches} showStage={!activeStage} />
    </div>
  );
}
