import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 2000;

/** SSE untuk Smart Incubation — mirror app/api/stream/sensor-readings/route.ts. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");

  if (!batchId) {
    return new Response("batchId wajib diisi", { status: 400 });
  }

  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return new Response("Batch tidak ditemukan", { status: 404 });
  }

  const encoder = new TextEncoder();
  const connectedAt = new Date();
  let lastReadingTimestamp = connectedAt;
  let lastDecisionTimestamp = connectedAt;
  let lastAlertTimestamp = connectedAt;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { batchId });

      const interval = setInterval(async () => {
        try {
          const readings = await prisma.incubationReading.findMany({
            where: { batchId, timestamp: { gt: lastReadingTimestamp } },
            orderBy: { timestamp: "asc" },
          });

          for (const reading of readings) {
            send("reading", reading);
            lastReadingTimestamp = reading.timestamp;
          }

          const decisions = await prisma.aIDecision.findMany({
            where: { batchId, timestamp: { gt: lastDecisionTimestamp } },
            orderBy: { timestamp: "asc" },
          });

          for (const decision of decisions) {
            send("decision", decision);
            lastDecisionTimestamp = decision.timestamp;
          }

          const alerts = await prisma.alert.findMany({
            where: { batchId, timestamp: { gt: lastAlertTimestamp } },
            orderBy: { timestamp: "asc" },
          });

          for (const alert of alerts) {
            send("alert", alert);
            lastAlertTimestamp = alert.timestamp;
          }
        } catch {
          send("error", { message: "Gagal mengambil data sensor terbaru" });
        }
      }, POLL_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
