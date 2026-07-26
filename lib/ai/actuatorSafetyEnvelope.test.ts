import { describe, expect, it } from "vitest";
import { applySafetyEnvelope, sensorSanityCheck, MAX_CONSECUTIVE_OPEN_COMMANDS } from "./actuatorSafetyEnvelope";

describe("sensorSanityCheck", () => {
  it("menerima nilai di dalam batas", () => {
    expect(sensorSanityCheck(6.5, { min: 0, max: 14 })).toBe(true);
  });

  it("menolak nilai di luar batas", () => {
    expect(sensorSanityCheck(20, { min: 0, max: 14 })).toBe(false);
  });

  it("menolak NaN/Infinity", () => {
    expect(sensorSanityCheck(NaN, { min: 0, max: 14 })).toBe(false);
    expect(sensorSanityCheck(Infinity, { min: 0, max: 14 })).toBe(false);
  });
});

describe("applySafetyEnvelope", () => {
  it("meloloskan command AI kalau sensor oke dan belum melebihi batas durasi", () => {
    const result = applySafetyEnvelope({ desiredAction: "OPEN", recentHistory: [], sensorsOk: true });
    expect(result.action).toBe("OPEN");
    expect(result.overridden).toBe(false);
  });

  it("AI mengalah kalau command terakhir untuk target ini dari operator (MANUAL)", () => {
    const result = applySafetyEnvelope({
      desiredAction: "OPEN",
      recentHistory: [{ action: "CLOSE", triggeredBy: "MANUAL" }],
      sensorsOk: true,
    });
    expect(result.action).toBeNull();
    expect(result.overridden).toBe(true);
  });

  it("fail-safe ke CLOSE kalau sensor di luar batas wajar, meski desired action OPEN", () => {
    const result = applySafetyEnvelope({ desiredAction: "OPEN", recentHistory: [], sensorsOk: false });
    expect(result.action).toBe("CLOSE");
    expect(result.overridden).toBe(true);
  });

  it("fail-safe ke OFF (bukan CLOSE) kalau desired action ON dan sensor rusak", () => {
    const result = applySafetyEnvelope({ desiredAction: "ON", recentHistory: [], sensorsOk: false });
    expect(result.action).toBe("OFF");
  });

  it("dipaksa tutup setelah command OPEN AI berturut-turut melebihi batas", () => {
    const history = Array.from({ length: MAX_CONSECUTIVE_OPEN_COMMANDS }, () => ({
      action: "OPEN" as const,
      triggeredBy: "AI" as const,
    }));
    const result = applySafetyEnvelope({ desiredAction: "OPEN", recentHistory: history, sensorsOk: true });
    expect(result.action).toBe("CLOSE");
    expect(result.overridden).toBe(true);
  });

  it("tidak dipaksa tutup kalau ada CLOSE yang memutus rentetan OPEN sebelumnya", () => {
    const history = [
      { action: "OPEN" as const, triggeredBy: "AI" as const },
      { action: "OPEN" as const, triggeredBy: "AI" as const },
      { action: "CLOSE" as const, triggeredBy: "AI" as const },
      { action: "OPEN" as const, triggeredBy: "AI" as const },
      { action: "OPEN" as const, triggeredBy: "AI" as const },
      { action: "OPEN" as const, triggeredBy: "AI" as const },
    ];
    const result = applySafetyEnvelope({ desiredAction: "OPEN", recentHistory: history, sensorsOk: true });
    expect(result.action).toBe("OPEN");
    expect(result.overridden).toBe(false);
  });

  it("CLOSE selalu diloloskan tanpa terkena batas durasi", () => {
    const history = Array.from({ length: MAX_CONSECUTIVE_OPEN_COMMANDS + 5 }, () => ({
      action: "OPEN" as const,
      triggeredBy: "AI" as const,
    }));
    const result = applySafetyEnvelope({ desiredAction: "CLOSE", recentHistory: history, sensorsOk: true });
    expect(result.action).toBe("CLOSE");
    expect(result.overridden).toBe(false);
  });
});
