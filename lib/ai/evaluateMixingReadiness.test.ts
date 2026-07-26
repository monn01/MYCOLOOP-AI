import { describe, expect, it } from "vitest";
import { evaluateMixingReadiness, MIXING_THRESHOLDS, type MixingReadingInput } from "./evaluateMixingReadiness";
import { ReadinessStatus } from "../generated/prisma/enums";

const HOUR_MS = 60 * 60 * 1000;
const BASE_TIME = new Date("2026-01-01T00:00:00Z").getTime();

function series(points: Array<{ kadarAir: number; rasioCN: number }>): MixingReadingInput[] {
  return points.map((p, i) => ({
    ...p,
    timestamp: new Date(BASE_TIME + i * 0.5 * HOUR_MS),
  }));
}

describe("evaluateMixingReadiness", () => {
  it("mengembalikan BELUM_SIAP dengan confidence 0 kalau belum ada data", () => {
    const result = evaluateMixingReadiness([]);
    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.confidence).toBe(0);
    expect(result.anomaly).toBeNull();
  });

  it("mengekspos threshold sesuai PRD (kadar air 50-60%, rasio C:N 25-35)", () => {
    expect(MIXING_THRESHOLDS.kadarAir).toEqual({ min: 50, max: 60 });
    expect(MIXING_THRESHOLDS.rasioCN).toEqual({ min: 25, max: 35 });
  });

  it("belum siap: kadar air & rasio C:N masih di luar rentang di awal proses", () => {
    const readings = series([
      { kadarAir: 70, rasioCN: 45 },
      { kadarAir: 69.5, rasioCN: 44.5 },
    ]);

    const result = evaluateMixingReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly).toBeNull();
  });

  it("dalam proses: parameter sudah masuk rentang target tapi trennya masih bergerak", () => {
    const older = [
      { kadarAir: 65, rasioCN: 38 },
      { kadarAir: 64.8, rasioCN: 37.9 },
      { kadarAir: 65.1, rasioCN: 38.1 },
      { kadarAir: 64.9, rasioCN: 38 },
      { kadarAir: 65, rasioCN: 38 },
    ];
    const recent = [
      { kadarAir: 58, rasioCN: 32 },
      { kadarAir: 57.8, rasioCN: 32 },
      { kadarAir: 58.1, rasioCN: 32 },
      { kadarAir: 57.9, rasioCN: 32 },
      { kadarAir: 58, rasioCN: 32 },
    ];

    const result = evaluateMixingReadiness(series([...older, ...recent]));

    expect(result.status).toBe(ReadinessStatus.DALAM_PROSES);
    expect(result.anomaly).toBeNull();
  });

  it("siap: parameter di rentang target dan stabil selama beberapa pembacaan berturut-turut", () => {
    const flat = Array.from({ length: 10 }, (_, i) => ({
      kadarAir: 55 + (i % 2 === 0 ? 0.2 : -0.2),
      rasioCN: 30 + (i % 2 === 0 ? 0.1 : -0.1),
    }));

    const result = evaluateMixingReadiness(series(flat));

    expect(result.status).toBe(ReadinessStatus.SIAP_STERILISASI);
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.anomaly).toBeNull();
  });

  it("anomali: penurunan kadar air drastis antar pembacaan berurutan", () => {
    const readings = series([
      { kadarAir: 58, rasioCN: 30 },
      { kadarAir: 57.8, rasioCN: 30 },
      { kadarAir: 47, rasioCN: 30 }, // drop >8%
    ]);

    const result = evaluateMixingReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly).not.toBeNull();
    expect(result.anomaly?.type).toBe("KADAR_AIR_DROP");
  });

  it("anomali: pergeseran rasio C:N drastis antar pembacaan berurutan", () => {
    const readings = series([
      { kadarAir: 58, rasioCN: 30 },
      { kadarAir: 58, rasioCN: 30.2 },
      { kadarAir: 58, rasioCN: 37 }, // shift >5
    ]);

    const result = evaluateMixingReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly).not.toBeNull();
    expect(result.anomaly?.type).toBe("RASIO_CN_SHIFT");
  });

  it("tidak salah anggap anomali kalau urutan reading diberikan acak (fungsi mengurutkan sendiri)", () => {
    const [a, b, c] = series([
      { kadarAir: 58, rasioCN: 30 },
      { kadarAir: 58.2, rasioCN: 30 },
      { kadarAir: 58.1, rasioCN: 30 },
    ]);

    const result = evaluateMixingReadiness([c, a, b]);

    expect(result.anomaly).toBeNull();
  });
});
