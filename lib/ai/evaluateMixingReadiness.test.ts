import { describe, expect, it } from "vitest";
import {
  evaluateMixingReadiness,
  MIXING_THRESHOLDS,
  MIXING_TARGET_TOTAL_WEIGHT_KG,
  type MixingReadingInput,
} from "./evaluateMixingReadiness";
import { ReadinessStatus } from "../generated/prisma/enums";

const HOUR_MS = 60 * 60 * 1000;
const BASE_TIME = new Date("2026-01-01T00:00:00Z").getTime();

function series(points: Array<{ pH: number; kekeruhanAir: number; beratKg: number }>): MixingReadingInput[] {
  return points.map((p, i) => ({
    ...p,
    timestamp: new Date(BASE_TIME + i * 0.1 * HOUR_MS),
  }));
}

describe("evaluateMixingReadiness", () => {
  it("mengembalikan BELUM_SIAP dengan confidence 0 dan semua valve tertutup kalau belum ada data", () => {
    const result = evaluateMixingReadiness([]);
    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.confidence).toBe(0);
    expect(result.anomaly).toBeNull();
    expect(Object.values(result.desiredValveState)).toEqual(["CLOSED", "CLOSED", "CLOSED"]);
  });

  it("mengekspos threshold sesuai desain baru (pH 6-7, kekeruhan air 200-500 NTU)", () => {
    expect(MIXING_THRESHOLDS.pH).toEqual({ min: 6.0, max: 7.0 });
    expect(MIXING_THRESHOLDS.kekeruhanAir).toEqual({ min: 200, max: 500 });
    expect(MIXING_TARGET_TOTAL_WEIGHT_KG).toBe(100);
  });

  it("membuka valve limbah jagung saat berat masih di bawah target channel pertama", () => {
    const readings = series([{ pH: 5.5, kekeruhanAir: 100, beratKg: 30 }]);
    const result = evaluateMixingReadiness(readings);

    expect(result.desiredValveState.limbah_jagung).toBe("OPEN");
    expect(result.desiredValveState.dedak).toBe("CLOSED");
    expect(result.desiredValveState.kapur).toBe("CLOSED");
    expect(result.status).toBe(ReadinessStatus.DALAM_PROSES);
  });

  it("membuka valve dedak setelah target berat limbah jagung tercapai", () => {
    const readings = series([{ pH: 5.8, kekeruhanAir: 150, beratKg: 80 }]);
    const result = evaluateMixingReadiness(readings);

    expect(result.desiredValveState.dedak).toBe("OPEN");
    expect(result.desiredValveState.limbah_jagung).toBe("CLOSED");
  });

  it("membuka valve kapur setelah target berat dedak tercapai", () => {
    const readings = series([{ pH: 6.0, kekeruhanAir: 250, beratKg: 95 }]);
    const result = evaluateMixingReadiness(readings);

    expect(result.desiredValveState.kapur).toBe("OPEN");
    expect(result.desiredValveState.dedak).toBe("CLOSED");
  });

  it("siap: berat total tercapai, pH & kekeruhan di rentang target dan stabil", () => {
    const flat = Array.from({ length: 10 }, (_, i) => ({
      pH: 6.5 + (i % 2 === 0 ? 0.03 : -0.03),
      kekeruhanAir: 350 + (i % 2 === 0 ? 3 : -3),
      beratKg: 100,
    }));

    const result = evaluateMixingReadiness(series(flat));

    expect(result.status).toBe(ReadinessStatus.SIAP_STERILISASI);
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.anomaly).toBeNull();
    expect(Object.values(result.desiredValveState)).toEqual(["CLOSED", "CLOSED", "CLOSED"]);
  });

  it("koreksi pH: berat sudah penuh tapi pH di luar target -> buka valve kapur", () => {
    const readings = series([
      { pH: 5.5, kekeruhanAir: 350, beratKg: 100 },
      { pH: 5.5, kekeruhanAir: 350, beratKg: 100 },
    ]);
    const result = evaluateMixingReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.DALAM_PROSES);
    expect(result.desiredValveState.kapur).toBe("OPEN");
    expect(result.desiredValveState.limbah_jagung).toBe("CLOSED");
    expect(result.anomaly).toBeNull();
  });

  it("koreksi kekeruhan: berat sudah penuh, pH oke tapi kekeruhan di luar target -> buka valve limbah jagung", () => {
    const readings = series([
      { pH: 6.5, kekeruhanAir: 100, beratKg: 100 },
      { pH: 6.5, kekeruhanAir: 100, beratKg: 100 },
    ]);
    const result = evaluateMixingReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.DALAM_PROSES);
    expect(result.desiredValveState.limbah_jagung).toBe("OPEN");
    expect(result.desiredValveState.kapur).toBe("CLOSED");
    expect(result.anomaly).toBeNull();
  });

  it("anomali: berat menurun antar pembacaan berurutan -> semua valve ditutup", () => {
    const readings = series([
      { pH: 6.5, kekeruhanAir: 350, beratKg: 50 },
      { pH: 6.5, kekeruhanAir: 350, beratKg: 40 },
    ]);
    const result = evaluateMixingReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly?.type).toBe("WEIGHT_ANOMALY");
    expect(Object.values(result.desiredValveState)).toEqual(["CLOSED", "CLOSED", "CLOSED"]);
  });

  it("anomali: pergeseran pH drastis antar pembacaan berurutan -> semua valve ditutup", () => {
    const readings = series([
      { pH: 6.0, kekeruhanAir: 350, beratKg: 50 },
      { pH: 6.1, kekeruhanAir: 350, beratKg: 55 },
      { pH: 7.5, kekeruhanAir: 350, beratKg: 55 }, // shift >1.0
    ]);
    const result = evaluateMixingReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly?.type).toBe("PH_SHIFT");
    expect(Object.values(result.desiredValveState)).toEqual(["CLOSED", "CLOSED", "CLOSED"]);
  });

  it("anomali: penurunan kekeruhan air drastis antar pembacaan berurutan -> semua valve ditutup", () => {
    const readings = series([
      { pH: 6.5, kekeruhanAir: 350, beratKg: 50 },
      { pH: 6.5, kekeruhanAir: 340, beratKg: 55 },
      { pH: 6.5, kekeruhanAir: 200, beratKg: 55 }, // drop >80
    ]);
    const result = evaluateMixingReadiness(readings);

    expect(result.status).toBe(ReadinessStatus.BELUM_SIAP);
    expect(result.anomaly?.type).toBe("KEKERUHAN_DROP");
    expect(Object.values(result.desiredValveState)).toEqual(["CLOSED", "CLOSED", "CLOSED"]);
  });

  it("tidak salah anggap anomali kalau urutan reading diberikan acak (fungsi mengurutkan sendiri)", () => {
    const [a, b, c] = series([
      { pH: 6.5, kekeruhanAir: 350, beratKg: 30 },
      { pH: 6.51, kekeruhanAir: 351, beratKg: 35 },
      { pH: 6.49, kekeruhanAir: 349, beratKg: 40 },
    ]);

    const result = evaluateMixingReadiness([c, a, b]);

    expect(result.anomaly).toBeNull();
  });
});
