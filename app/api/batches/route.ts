import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getOrCreateDefaultUser } from "@/lib/db/default-user";
import { BatchStatus, PipelineStage } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const VALID_STATUSES = Object.values(BatchStatus);
const VALID_STAGES = Object.values(PipelineStage);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const stageParam = searchParams.get("stage");
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

  if (status && !VALID_STATUSES.includes(status as BatchStatus)) {
    return NextResponse.json(
      { error: `status tidak valid, harus salah satu dari: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (stageParam && !VALID_STAGES.includes(stageParam as PipelineStage)) {
    return NextResponse.json(
      { error: `stage tidak valid, harus salah satu dari: ${VALID_STAGES.join(", ")}` },
      { status: 400 }
    );
  }

  // Software ini (lihat PRD.md §1.1) cuma pernah membuat batch PRE_CONDITIONING.
  // Default-kan filter ke stage itu supaya kalau nanti software Stage 1/3 mulai
  // menulis ke tabel yang sama, endpoint ini tidak diam-diam ikut menampilkannya.
  const stage = (stageParam as PipelineStage | null) ?? PipelineStage.PRE_CONDITIONING;

  const batches = await prisma.batch.findMany({
    where: { stage, ...(status ? { status: status as BatchStatus } : {}) },
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

  let stage: PipelineStage = PipelineStage.PRE_CONDITIONING;
  if (body?.stage !== undefined) {
    if (!VALID_STAGES.includes(body.stage)) {
      return NextResponse.json(
        { error: `stage tidak valid, harus salah satu dari: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }
    stage = body.stage;
  }

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
    data: { formula, createdById, stage },
  });

  return NextResponse.json({ batch }, { status: 201 });
}
