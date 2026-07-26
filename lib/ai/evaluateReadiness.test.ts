import { describe, expect, it } from "vitest";
import { evaluateReadiness, THRESHOLDS, type SensorReadingInput } from "./evaluateReadiness";
import { ReadinessStatus } from "../generated/prisma/enums";

const HOUR_MS = 60 * 60 * 1000;
const BASE_TIME = new Date("2026-01-01T00:00:00Z").getTime();

/** Bikin deret pembacaan berjarak 30 menit, dimulai dari BASE_TIME. */
function series(points: Array<{ suhu: number; kelembapan: number }>): SensorReadingInput[] {
  return points.map((p, i) => ({
    ...p,
    timestamp: new Date(BASE_TIME + i * 0.5 * HOUR_MS),
  }));
}

describe("evaluateReadiness", () => {
  it("mengembalikan BELUM_SIAP dengan confidence 0 kalau belum ada data", () => {
    const result = evaluateReadiness([]);
    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.confidence).toBe(0);
    expect(result.anomaly).toBeNull();
  });

  it("mengekspos threshold sesuai PRD (suhu 25-35, kelembapan 60-65) — pH pindah ke Mixing", () => {
    expect(THRESHOLDS.suhu).toEqual({ min: 25, max: 35 });
    expect(THRESHOLDS.kelembapan).toEqual({ min: 60, max: 65 });
  });

  it("media belum siap: suhu & kelembapan masih tinggi di awal proses", () => {
    const readings = series([
      { suhu: 38, kelembapan: 75 },
      { suhu: 37.8, kelembapan: 74.5 },
    ]);

    const result = evaluateReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly).toBeNull();
  });

  it("dalam proses: parameter sudah masuk rentang target tapi trennya masih bergerak turun", () => {
    const older = [
      { suhu: 33, kelembapan: 62 },
      { suhu: 33.2, kelembapan: 62.1 },
      { suhu: 33.1, kelembapan: 61.9 },
      { suhu: 32.9, kelembapan: 62 },
      { suhu: 33, kelembapan: 62 },
    ];
    const recent = [
      { suhu: 30, kelembapan: 62 },
      { suhu: 29.8, kelembapan: 62 },
      { suhu: 30.1, kelembapan: 62 },
      { suhu: 29.9, kelembapan: 62 },
      { suhu: 30, kelembapan: 62 },
    ];

    const result = evaluateReadiness(series([...older, ...recent]));

    expect(result.status).toBe(ReadinessStatus.DALAM_PROSES);
    expect(result.anomaly).toBeNull();
  });

  it("media siap: parameter di rentang target dan stabil selama beberapa pembacaan berturut-turut", () => {
    const flat = Array.from({ length: 10 }, (_, i) => ({
      suhu: 30 + (i % 2 === 0 ? 0.1 : -0.1),
      kelembapan: 62 + (i % 2 === 0 ? 0.2 : -0.2),
    }));

    const result = evaluateReadiness(series(flat));

    expect(result.status).toBe(ReadinessStatus.SIAP_STERILISASI);
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.anomaly).toBeNull();
  });

  it("anomali: lonjakan suhu mendadak antar pembacaan berurutan", () => {
    const readings = series([
      { suhu: 30, kelembapan: 62 },
      { suhu: 30.2, kelembapan: 62 },
      { suhu: 38.5, kelembapan: 62 }, // lonjakan >6°C
    ]);

    const result = evaluateReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly).not.toBeNull();
    expect(result.anomaly?.type).toBe("SUHU_SPIKE");
  });

  it("tidak salah anggap anomali kalau urutan reading diberikan acak (fungsi mengurutkan sendiri)", () => {
    const [a, b, c] = series([
      { suhu: 30, kelembapan: 62 },
      { suhu: 30.2, kelembapan: 62 },
      { suhu: 30.1, kelembapan: 62 },
    ]);

    const result = evaluateReadiness([c, a, b]);

    expect(result.anomaly).toBeNull();
  });
});
