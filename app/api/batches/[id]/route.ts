import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { BatchStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const VALID_STATUSES = Object.values(BatchStatus);
const END_STATES: BatchStatus[] = [BatchStatus.COMPLETED, BatchStatus.ABORTED];

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { sensorReadings: true, aiDecisions: true, alerts: true } },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ batch });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const existing = await prisma.batch.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body request tidak valid" }, { status: 400 });
  }

  const data: {
    status?: BatchStatus;
    formula?: string;
    endTime?: Date | null;
  } = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status tidak valid, harus salah satu dari: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    data.status = body.status;
    if (END_STATES.includes(body.status) && !existing.endTime) {
      data.endTime = new Date();
    }
  }

  if (body.formula !== undefined) {
    if (body.formula !== null && typeof body.formula !== "string") {
      return NextResponse.json({ error: "formula harus string atau null" }, { status: 400 });
    }
    data.formula = body.formula;
  }

  if (body.endTime !== undefined) {
    if (body.endTime === null) {
      data.endTime = null;
    } else {
      const parsed = new Date(body.endTime);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "endTime harus tanggal ISO yang valid" }, { status: 400 });
      }
      data.endTime = parsed;
    }
  }

  const batch = await prisma.batch.update({ where: { id: params.id }, data });

  return NextResponse.json({ batch });
}
