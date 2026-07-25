import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

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

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 200;

  let from: Date | undefined;
  let to: Date | undefined;

  if (fromParam) {
    from = new Date(fromParam);
    if (Number.isNaN(from.getTime())) {
      return NextResponse.json({ error: "from harus tanggal ISO yang valid" }, { status: 400 });
    }
  }
  if (toParam) {
    to = new Date(toParam);
    if (Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "to harus tanggal ISO yang valid" }, { status: 400 });
    }
  }

  const timestampFilter = from || to ? { gte: from, lte: to } : undefined;

  if (timestampFilter) {
    // Range eksplisit diminta: urutkan naik, tampilkan seluruh rentang.
    const readings = await prisma.sensorReading.findMany({
      where: { batchId, timestamp: timestampFilter },
      orderBy: { timestamp: "asc" },
      take: limit,
    });
    return NextResponse.json({ readings });
  }

  // Tanpa range: ambil N pembacaan paling baru, lalu urutkan naik untuk chart.
  const recent = await prisma.sensorReading.findMany({
    where: { batchId },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json({ readings: recent.reverse() });
}
