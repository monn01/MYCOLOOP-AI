import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getOrCreateDefaultUser } from "@/lib/db/default-user";
import { BatchStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const VALID_STATUSES = Object.values(BatchStatus);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

  if (status && !VALID_STATUSES.includes(status as BatchStatus)) {
    return NextResponse.json(
      { error: `status tidak valid, harus salah satu dari: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const batches = await prisma.batch.findMany({
    where: status ? { status: status as BatchStatus } : undefined,
    orderBy: { startTime: "desc" },
    take: limit,
    include: {
      _count: { select: { sensorReadings: true, aiDecisions: true, alerts: true } },
    },
  });

  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const formula = typeof body?.formula === "string" ? body.formula : undefined;
  let createdById = typeof body?.createdById === "string" ? body.createdById : undefined;

  if (createdById) {
    const user = await prisma.user.findUnique({ where: { id: createdById } });
    if (!user) {
      return NextResponse.json({ error: `User ${createdById} tidak ditemukan` }, { status: 400 });
    }
  } else {
    const defaultUser = await getOrCreateDefaultUser();
    createdById = defaultUser.id;
  }

  const batch = await prisma.batch.create({
    data: { formula, createdById },
  });

  return NextResponse.json({ batch }, { status: 201 });
}
