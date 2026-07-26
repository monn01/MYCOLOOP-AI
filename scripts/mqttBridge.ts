import "dotenv/config";
import { prisma } from "../lib/db/client";
import { startMqttBridge, stopMqttBridge } from "../lib/mqtt/bridge";

async function main() {
  console.log("Memulai MQTT bridge (lihat lib/mqtt/bridge.ts buat kontrak topic)...");
  await startMqttBridge();
  console.log("Tekan Ctrl+C untuk berhenti.");
}

process.on("SIGINT", async () => {
  console.log("\nDihentikan manual (SIGINT).");
  stopMqttBridge();
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
