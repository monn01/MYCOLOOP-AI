import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 2000;

/**
 * Server-Sent Events: push SensorReading baru ke client tanpa polling manual
 * dari browser. Backend sendiri masih polling DB tiap POLL_INTERVAL_MS —
 * cukup untuk target <5 detik latensi (PRD.md #9) di skala kompetisi ini.
 * Diganti trigger berbasis MQTT/LISTEN-NOTIFY kalau volume data naik.
 */
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
  let lastTimestamp = new Date(0);

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
          const readings = await prisma.sensorReading.findMany({
            where: { batchId, timestamp: { gt: lastTimestamp } },
            orderBy: { timestamp: "asc" },
          });

          for (const reading of readings) {
            send("reading", reading);
            lastTimestamp = reading.timestamp;
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
