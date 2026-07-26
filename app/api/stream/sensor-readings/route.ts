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
  // Mulai dari saat koneksi dibuka, bukan epoch — histori sudah dibackfill
  // lewat GET terpisah di client (lib/hooks/use-batch-stream.ts). Kalau mulai
  // dari epoch, tiap reconnect akan replay seluruh histori batch (duplikat di
  // state client, dan pada decision/alert bikin toast lama muncul lagi).
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
          const readings = await prisma.sensorReading.findMany({
            where: { batchId, timestamp: { gt: lastReadingTimestamp } },
            orderBy: { timestamp: "asc" },
          });

          for (const reading of readings) {
            send("reading", reading);
            lastReadingTimestamp = reading.timestamp;
          }

          // Decision & alert dipush lewat koneksi SSE yang sama supaya
          // toast/banner (design.md §5.8) bisa reaktif tanpa polling terpisah.
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
