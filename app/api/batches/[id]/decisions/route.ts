import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Riwayat AIDecision untuk satu batch, terbaru dulu — dipakai untuk timeline
 * di AI Decision Panel (design.md §5.6) dan status hero card (§5.3).
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 5;

  const batch = await prisma.batch.findUnique({ where: { id: params.id } });
  if (!batch) {
    return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
  }

  const decisions = await prisma.aIDecision.findMany({
    where: { batchId: params.id },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json({ decisions });
}
