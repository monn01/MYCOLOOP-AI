import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { AlertType } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const VALID_TYPES = Object.values(AlertType);

/**
 * Daftar Alert, dipakai untuk Alert Banner (design.md §5.8). Default hanya
 * yang belum resolved, urut terbaru dulu. Filter batchId opsional untuk
 * halaman Monitor/Batch Detail; tanpa batchId dipakai untuk Dashboard Utama
 * (alert lintas batch aktif).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");
  const typeParam = searchParams.get("type");
  const resolvedParam = searchParams.get("resolved");
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

  if (typeParam && !VALID_TYPES.includes(typeParam as AlertType)) {
    return NextResponse.json(
      { error: `type tidak valid, harus salah satu dari: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const resolved = resolvedParam === null ? false : resolvedParam === "true";

  const alerts = await prisma.alert.findMany({
    where: {
      resolved,
      ...(batchId ? { batchId } : {}),
      ...(typeParam ? { type: typeParam as AlertType } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { batch: { select: { id: true, formula: true } } },
  });

  return NextResponse.json({ alerts });
}
