import "dotenv/config";
import mqtt from "mqtt";
import { baseReadingAt, DEFAULT_DURATION_HOURS } from "../lib/simulator/curve";
import { baseMixingReadingAt, DEFAULT_MIXING_DURATION_HOURS } from "../lib/simulator/curveMixing";
import { baseIncubationReadingAt, DEFAULT_INCUBATION_DURATION_HOURS } from "../lib/simulator/curveIncubation";

/**
 * "ESP32 palsu" buat nge-tes lib/mqtt/bridge.ts end-to-end tanpa hardware
 * fisik (lihat TASKPLAN.md Phase 6a). BEDA dari scripts/simulate*.ts: script
 * ini publish ke MQTT broker sungguhan (jalur kabel yang sama persis dengan
 * firmware asli nanti), bukan insert langsung ke database — jadi benar-benar
 * nge-tes bridge, bukan cuma logic AI-nya.
 */

type Stage = "mixing" | "pre-conditioning" | "incubation";

const TOPIC: Record<Stage, string> = {
  mixing: "mycoloop/mixing/sensor",
  "pre-conditioning": "mycoloop/pre-conditioning/sensor",
  incubation: "mycoloop/incubation/sensor",
};

interface CliOptions {
  stage: Stage;
  intervalSeconds: number;
  speedMinutesPerTick: number;
  durationHours: number;
}

function defaultDurationFor(stage: Stage): number {
  if (stage === "mixing") return DEFAULT_MIXING_DURATION_HOURS;
  if (stage === "incubation") return DEFAULT_INCUBATION_DURATION_HOURS;
  return DEFAULT_DURATION_HOURS;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    stage: "mixing",
    intervalSeconds: 5,
    speedMinutesPerTick: 15,
    durationHours: -1, // diisi default per-stage kalau tidak dispesifikkan
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--stage": {
        const value = next();
        if (value === "mixing" || value === "pre-conditioning" || value === "incubation") {
          options.stage = value;
        } else {
          console.warn(`--stage tidak dikenal (${value}), pakai "mixing"`);
        }
        break;
      }
      case "--interval":
        options.intervalSeconds = Number(next());
        break;
      case "--speed":
        options.speedMinutesPerTick = Number(next());
        break;
      case "--duration":
        options.durationHours = Number(next());
        break;
      default:
        console.warn(`Argumen tidak dikenal, diabaikan: ${arg}`);
    }
  }

  if (options.durationHours < 0) options.durationHours = defaultDurationFor(options.stage);
  return options;
}

function pointFor(stage: Stage, hourIntoProcess: number, totalHours: number) {
  if (stage === "mixing") return baseMixingReadingAt(hourIntoProcess, totalHours);
  if (stage === "incubation") return baseIncubationReadingAt(hourIntoProcess, totalHours);
  return baseReadingAt(hourIntoProcess, totalHours);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    throw new Error("MQTT_BROKER_URL belum diset di .env — lihat .env.example.");
  }

  const topic = TOPIC[options.stage];
  const client = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  });

  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("error", reject);
  });

  console.log(`Mock ESP32 (${options.stage}) terhubung ke ${brokerUrl}, publish ke ${topic}`);
  console.log(
    `interval=${options.intervalSeconds}s, speed=${options.speedMinutesPerTick} menit-simulasi/tick, ` +
      `duration=${options.durationHours}jam`
  );
  console.log("Tekan Ctrl+C untuk berhenti.\n");

  let running = true;
  process.on("SIGINT", () => {
    console.log("\nDihentikan manual (SIGINT).");
    running = false;
  });

  let elapsedHours = 0;
  let tick = 0;
  while (running) {
    if (elapsedHours >= options.durationHours) {
      console.log("Durasi simulasi tercapai, berhenti.");
      break;
    }

    const point = pointFor(options.stage, elapsedHours, options.durationHours);
    client.publish(topic, JSON.stringify(point), { qos: 1 });
    console.log(`[tick ${tick}] jam-ke-${elapsedHours.toFixed(1)} ->`, point);

    elapsedHours += options.speedMinutesPerTick / 60;
    tick++;
    await delay(options.intervalSeconds * 1000);
  }

  client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
