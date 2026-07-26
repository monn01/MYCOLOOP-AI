import { describe, expect, it } from "vitest";
import {
  evaluateIncubationReadiness,
  INCUBATION_THRESHOLDS,
  type IncubationReadingInput,
} from "./evaluateIncubationReadiness";
import { ReadinessStatus } from "../generated/prisma/enums";

const HOUR_MS = 60 * 60 * 1000;
const BASE_TIME = new Date("2026-01-01T00:00:00Z").getTime();

function series(
  points: Array<{ suhu: number; kelembapan: number; co2: number; cahaya: number }>
): IncubationReadingInput[] {
  return points.map((p, i) => ({
    ...p,
    timestamp: new Date(BASE_TIME + i * 0.5 * HOUR_MS),
  }));
}

describe("evaluateIncubationReadiness", () => {
  it("mengembalikan BELUM_SIAP dengan confidence 0 kalau belum ada data", () => {
    const result = evaluateIncubationReadiness([]);
    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.confidence).toBe(0);
    expect(result.anomaly).toBeNull();
  });

  it("mengekspos threshold sesuai PRD (suhu 22-28, kelembapan 70-90, CO2 500-1500, cahaya 0-50)", () => {
    expect(INCUBATION_THRESHOLDS.suhu).toEqual({ min: 22, max: 28 });
    expect(INCUBATION_THRESHOLDS.kelembapan).toEqual({ min: 70, max: 90 });
    expect(INCUBATION_THRESHOLDS.co2).toEqual({ min: 500, max: 1500 });
    expect(INCUBATION_THRESHOLDS.cahaya).toEqual({ min: 0, max: 50 });
  });

  it("belum siap: parameter masih di luar rentang di awal proses", () => {
    const readings = series([
      { suhu: 32, kelembapan: 55, co2: 300, cahaya: 200 },
      { suhu: 31.8, kelembapan: 55.5, co2: 310, cahaya: 195 },
    ]);

    const result = evaluateIncubationReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly).toBeNull();
  });

  it("dalam proses: parameter sudah masuk rentang target tapi trennya masih bergerak", () => {
    const older = [
      { suhu: 26, kelembapan: 82, co2: 900, cahaya: 20 },
      { suhu: 25.9, kelembapan: 82.1, co2: 895, cahaya: 20 },
      { suhu: 26.1, kelembapan: 81.9, co2: 905, cahaya: 20 },
      { suhu: 25.8, kelembapan: 82, co2: 900, cahaya: 20 },
      { suhu: 26, kelembapan: 82, co2: 900, cahaya: 20 },
    ];
    const recent = [
      { suhu: 24, kelembapan: 80, co2: 1000, cahaya: 20 },
      { suhu: 23.8, kelembapan: 80, co2: 1000, cahaya: 20 },
      { suhu: 24.1, kelembapan: 80, co2: 1000, cahaya: 20 },
      { suhu: 23.9, kelembapan: 80, co2: 1000, cahaya: 20 },
      { suhu: 24, kelembapan: 80, co2: 1000, cahaya: 20 },
    ];

    const result = evaluateIncubationReadiness(series([...older, ...recent]));

    expect(result.status).toBe(ReadinessStatus.DALAM_PROSES);
    expect(result.anomaly).toBeNull();
  });

  it("siap: parameter di rentang target dan stabil selama beberapa pembacaan berturut-turut", () => {
    const flat = Array.from({ length: 10 }, (_, i) => ({
      suhu: 25 + (i % 2 === 0 ? 0.1 : -0.1),
      kelembapan: 80 + (i % 2 === 0 ? 0.2 : -0.2),
      co2: 900 + (i % 2 === 0 ? 5 : -5),
      cahaya: 15 + (i % 2 === 0 ? 1 : -1),
    }));

    const result = evaluateIncubationReadiness(series(flat));

    expect(result.status).toBe(ReadinessStatus.SIAP_STERILISASI);
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.anomaly).toBeNull();
  });

  it("anomali: lonjakan suhu mendadak antar pembacaan berurutan", () => {
    const readings = series([
      { suhu: 25, kelembapan: 80, co2: 900, cahaya: 20 },
      { suhu: 25.2, kelembapan: 80, co2: 900, cahaya: 20 },
      { suhu: 31, kelembapan: 80, co2: 900, cahaya: 20 }, // lonjakan >5°C
    ]);

    const result = evaluateIncubationReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly).not.toBeNull();
    expect(result.anomaly?.type).toBe("SUHU_SPIKE");
    expect(result.anomaly?.isContamination).toBe(false);
  });

  it("kontaminasi: lonjakan CO2 bersamaan penurunan kelembapan drastis", () => {
    const readings = series([
      { suhu: 25, kelembapan: 80, co2: 900, cahaya: 20 },
      { suhu: 25, kelembapan: 80, co2: 910, cahaya: 20 },
      { suhu: 25, kelembapan: 68, co2: 1400, cahaya: 20 }, // CO2 +490, kelembapan -12
    ]);

    const result = evaluateIncubationReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly).not.toBeNull();
    expect(result.anomaly?.type).toBe("CONTAMINATION_PATTERN");
    expect(result.anomaly?.isContamination).toBe(true);
  });

  it("tidak salah anggap anomali kalau urutan reading diberikan acak (fungsi mengurutkan sendiri)", () => {
    const [a, b, c] = series([
      { suhu: 25, kelembapan: 80, co2: 900, cahaya: 20 },
      { suhu: 25.2, kelembapan: 80, co2: 900, cahaya: 20 },
      { suhu: 25.1, kelembapan: 80, co2: 900, cahaya: 20 },
    ]);

    const result = evaluateIncubationReadiness([c, a, b]);

    expect(result.anomaly).toBeNull();
  });
});
