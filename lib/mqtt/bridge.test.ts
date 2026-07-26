import { describe, expect, it } from "vitest";
import {
  parseMixingPayload,
  parsePreConditioningPayload,
  parseIncubationPayload,
  SENSOR_TOPIC,
  COMMAND_TOPIC,
} from "./bridge";

describe("payload parsers (kontrak topic MQTT, lihat TASKPLAN.md Phase 6a)", () => {
  it("menerima payload Mixing yang valid", () => {
    const result = parseMixingPayload({ pH: 6.5, kekeruhanAir: 350, beratKg: 100 });
    expect(result).toEqual({ pH: 6.5, kekeruhanAir: 350, beratKg: 100 });
  });

  it("menolak payload Mixing dengan field bertipe string", () => {
    expect(parseMixingPayload({ pH: "6.5", kekeruhanAir: 350, beratKg: 100 })).toBeNull();
  });

  it("menolak payload Mixing dengan field hilang", () => {
    expect(parseMixingPayload({ pH: 6.5, kekeruhanAir: 350 })).toBeNull();
  });

  it("menolak payload Mixing dengan NaN/Infinity", () => {
    expect(parseMixingPayload({ pH: NaN, kekeruhanAir: 350, beratKg: 100 })).toBeNull();
    expect(parseMixingPayload({ pH: 6.5, kekeruhanAir: Infinity, beratKg: 100 })).toBeNull();
  });

  it("menolak payload bukan object (string/null/array)", () => {
    expect(parseMixingPayload("not an object")).toBeNull();
    expect(parseMixingPayload(null)).toBeNull();
    expect(parseMixingPayload([1, 2, 3])).toBeNull();
  });

  it("menerima payload Pre-Conditioning yang valid (tanpa pH, lihat pivot arsitektur)", () => {
    const result = parsePreConditioningPayload({ suhu: 30, kelembapan: 62 });
    expect(result).toEqual({ suhu: 30, kelembapan: 62 });
  });

  it("menerima payload Incubation yang valid", () => {
    const result = parseIncubationPayload({ suhu: 25, kelembapan: 80, co2: 800, cahaya: 10 });
    expect(result).toEqual({ suhu: 25, kelembapan: 80, co2: 800, cahaya: 10 });
  });

  it("menolak payload Incubation dengan field hilang", () => {
    expect(parseIncubationPayload({ suhu: 25, kelembapan: 80, co2: 800 })).toBeNull();
  });
});

describe("kontrak topic", () => {
  it("tiap sensor topic di-namespace per stage, tidak ada batchId (firmware tidak perlu tahu batch)", () => {
    expect(SENSOR_TOPIC.MIXING).toBe("mycoloop/mixing/sensor");
    expect(SENSOR_TOPIC.PRE_CONDITIONING).toBe("mycoloop/pre-conditioning/sensor");
    expect(SENSOR_TOPIC.INCUBATION).toBe("mycoloop/incubation/sensor");
  });

  it("command topic cuma ada buat stage yang punya aktuator (Mixing, Pre-Conditioning)", () => {
    expect(COMMAND_TOPIC.MIXING).toBe("mycoloop/mixing/command");
    expect(COMMAND_TOPIC.PRE_CONDITIONING).toBe("mycoloop/pre-conditioning/command");
    expect("INCUBATION" in COMMAND_TOPIC).toBe(false);
  });
});
