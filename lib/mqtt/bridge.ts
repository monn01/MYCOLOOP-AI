import mqtt, { type MqttClient } from "mqtt";
import { prisma } from "@/lib/db/client";
import { getOrCreateDefaultUser } from "@/lib/db/default-user";
import { ingestSensorReading } from "@/lib/sensors/ingest";
import { ingestMixingReading } from "@/lib/sensors/ingestMixing";
import { ingestIncubationReading } from "@/lib/sensors/ingestIncubation";
import { PipelineStage } from "@/lib/generated/prisma/enums";

/**
 * MQTT subscriber/publisher bridge (lihat PRD.md §6.2, TASKPLAN.md Phase 6a).
 * Jalan sebagai proses terpisah (`npm run mqtt:bridge`), bukan inline di
 * request handler Next.js — API routes tidak cocok buat koneksi persisten.
 *
 * Kontrak topic (device/stage-scoped — firmware TIDAK perlu tahu konsep
 * "batch", backend yang resolve/buat batch RUNNING aktif per stage, sama
 * seperti pola `getOrCreateRunningBatch` di scripts/simulate*.ts):
 *
 *   Sensor (ESP32 -> backend), payload JSON, angka bukan string:
 *     mycoloop/mixing/sensor           { pH, kekeruhanAir, beratKg }
 *     mycoloop/pre-conditioning/sensor { suhu, kelembapan }
 *     mycoloop/incubation/sensor       { suhu, kelembapan, co2, cahaya }
 *
 *   Command (backend -> ESP32), payload JSON:
 *     mycoloop/mixing/command           { target, action, level, reasoning }
 *     mycoloop/pre-conditioning/command { target, action, level, reasoning } (Phase 5f, belum ada pengirim)
 *
 * Payload yang gagal di-parse/divalidasi di-drop dengan warning log — satu
 * ESP32 yang ngirim data rusak tidak boleh mematikan seluruh bridge.
 */

export const SENSOR_TOPIC = {
  MIXING: "mycoloop/mixing/sensor",
  PRE_CONDITIONING: "mycoloop/pre-conditioning/sensor",
  INCUBATION: "mycoloop/incubation/sensor",
} as const;

export const COMMAND_TOPIC = {
  MIXING: "mycoloop/mixing/command",
  PRE_CONDITIONING: "mycoloop/pre-conditioning/command",
} as const;

const TOPIC_STAGE: Record<string, PipelineStage> = {
  [SENSOR_TOPIC.MIXING]: PipelineStage.MIXING,
  [SENSOR_TOPIC.PRE_CONDITIONING]: PipelineStage.PRE_CONDITIONING,
  [SENSOR_TOPIC.INCUBATION]: PipelineStage.INCUBATION,
};

const DEFAULT_FORMULA: Record<PipelineStage, string> = {
  MIXING: "Batch Mixing dari ESP32 (auto-created oleh MQTT bridge)",
  PRE_CONDITIONING: "Batch Pre-Conditioning dari ESP32 (auto-created oleh MQTT bridge)",
  INCUBATION: "Batch Incubation dari ESP32 (auto-created oleh MQTT bridge)",
};

/** Sama seperti pola di scripts/simulate*.ts — kalau belum ada batch RUNNING
 * untuk stage ini, buat otomatis begitu data sensor pertama masuk. */
async function getOrCreateRunningBatch(stage: PipelineStage) {
  const existing = await prisma.batch.findFirst({
    where: { status: "RUNNING", stage },
    orderBy: { startTime: "desc" },
  });
  if (existing) return existing;

  const user = await getOrCreateDefaultUser();
  return prisma.batch.create({
    data: { status: "RUNNING", stage, formula: DEFAULT_FORMULA[stage], createdById: user.id },
  });
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function parseMixingPayload(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return null;
  const { pH, kekeruhanAir, beratKg } = raw as Record<string, unknown>;
  if (!isFiniteNumber(pH) || !isFiniteNumber(kekeruhanAir) || !isFiniteNumber(beratKg)) return null;
  return { pH, kekeruhanAir, beratKg };
}

export function parsePreConditioningPayload(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return null;
  const { suhu, kelembapan } = raw as Record<string, unknown>;
  if (!isFiniteNumber(suhu) || !isFiniteNumber(kelembapan)) return null;
  return { suhu, kelembapan };
}

export function parseIncubationPayload(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return null;
  const { suhu, kelembapan, co2, cahaya } = raw as Record<string, unknown>;
  if (!isFiniteNumber(suhu) || !isFiniteNumber(kelembapan) || !isFiniteNumber(co2) || !isFiniteNumber(cahaya)) return null;
  return { suhu, kelembapan, co2, cahaya };
}

function warnInvalidPayload(topic: string, raw: unknown) {
  console.warn(`[mqtt-bridge] Payload tidak sesuai skema dari ${topic}, diabaikan:`, raw);
}

let client: MqttClient | null = null;

function publishCommand(topic: string, command: unknown) {
  if (!client) return;
  client.publish(topic, JSON.stringify(command), { qos: 1 }, (err) => {
    if (err) console.error(`[mqtt-bridge] Gagal publish command ke ${topic}:`, err.message);
  });
}

async function handleMessage(topic: string, payloadBuffer: Buffer) {
  const stage = TOPIC_STAGE[topic];
  if (!stage) return; // topic tidak dikenal (mis. sisa retained message lama), abaikan

  let raw: unknown;
  try {
    raw = JSON.parse(payloadBuffer.toString("utf-8"));
  } catch {
    console.warn(`[mqtt-bridge] Payload bukan JSON valid dari ${topic}, diabaikan.`);
    return;
  }

  const batch = await getOrCreateRunningBatch(stage);

  if (stage === PipelineStage.MIXING) {
    const point = parseMixingPayload(raw);
    if (!point) return warnInvalidPayload(topic, raw);
    const result = await ingestMixingReading({ batchId: batch.id, ...point });
    console.log(`[mqtt-bridge] Mixing reading masuk (batch ${batch.id}) -> AI: ${result.decision.status}`);
    for (const command of result.actuatorCommands) {
      publishCommand(COMMAND_TOPIC.MIXING, command);
    }
    return;
  }

  if (stage === PipelineStage.PRE_CONDITIONING) {
    const point = parsePreConditioningPayload(raw);
    if (!point) return warnInvalidPayload(topic, raw);
    const result = await ingestSensorReading({ batchId: batch.id, ...point });
    console.log(`[mqtt-bridge] Pre-Conditioning reading masuk (batch ${batch.id}) -> AI: ${result.decision.status}`);
    // Fan belum dikontrol AI (TASKPLAN.md Phase 5f) — begitu ingestSensorReading
    // balikin actuatorCommands, publish ke COMMAND_TOPIC.PRE_CONDITIONING di sini.
    return;
  }

  if (stage === PipelineStage.INCUBATION) {
    const point = parseIncubationPayload(raw);
    if (!point) return warnInvalidPayload(topic, raw);
    const result = await ingestIncubationReading({ batchId: batch.id, ...point });
    console.log(`[mqtt-bridge] Incubation reading masuk (batch ${batch.id}) -> AI: ${result.decision.status}`);
  }
}

export async function startMqttBridge(): Promise<MqttClient> {
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    throw new Error("MQTT_BROKER_URL belum diset di .env — lihat .env.example.");
  }

  client = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 3000,
  });

  client.on("connect", () => {
    console.log(`[mqtt-bridge] Terhubung ke ${brokerUrl}`);
    client!.subscribe(Object.values(SENSOR_TOPIC), { qos: 1 }, (err) => {
      if (err) console.error("[mqtt-bridge] Gagal subscribe:", err.message);
      else console.log(`[mqtt-bridge] Subscribe ke: ${Object.values(SENSOR_TOPIC).join(", ")}`);
    });
  });

  client.on("reconnect", () => console.log("[mqtt-bridge] Reconnecting..."));
  client.on("error", (err) => console.error("[mqtt-bridge] Error:", err.message));
  client.on("close", () => console.log("[mqtt-bridge] Koneksi ke broker tertutup."));

  client.on("message", (topic, payloadBuffer) => {
    handleMessage(topic, payloadBuffer).catch((err) => {
      console.error(`[mqtt-bridge] Gagal proses pesan dari ${topic}:`, err);
    });
  });

  return client;
}

export function stopMqttBridge() {
  client?.end();
  client = null;
}
