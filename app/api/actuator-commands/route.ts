import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Audit trail command aktuator (lihat PRD.md §7.5/§7.2/§8, pivot arsitektur
 * 2026-07-26). Generik lintas target — dipakai Mixing (valve) dan
 * Pre-Conditioning (fan, Phase 5f).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");

  if (!batchId) {
    return NextResponse.json({ error: "batchId wajib diisi" }, { status: 400 });
  }

  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
  }

  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 20;

  const commands = await prisma.actuatorCommand.findMany({
    where: { batchId },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json({ commands });
}
