/**
 * Safety envelope untuk command aktuator AI (lihat PRD.md §7.5/§7.2/§12,
 * pivot arsitektur 2026-07-26). Generik lintas target (valve Mixing, fan
 * Pre-Conditioning Phase 5f) — tidak tahu apa-apa soal domain sensor,
 * cuma menjaga tiga hal: operator selalu menang di atas AI, aktuator tidak
 * "lupa" tertutup kalau sensor rusak, dan tidak menyala/terbuka tanpa batas
 * waktu tanpa verifikasi ulang.
 */

export type ActuatorAction = "OPEN" | "CLOSE" | "ON" | "OFF";
export type ActuatorTrigger = "AI" | "MANUAL";

/** Command open-family dipasangkan ke fail-safe close-family yang sesuai. */
const FAIL_SAFE_ACTION: Record<ActuatorAction, ActuatorAction> = {
  OPEN: "CLOSE",
  CLOSE: "CLOSE",
  ON: "OFF",
  OFF: "OFF",
};

const OPEN_FAMILY = new Set<ActuatorAction>(["OPEN", "ON"]);

/** Berapa kali command "buka/nyala" AI berturut-turut diizinkan sebelum
 * dipaksa fail-safe untuk verifikasi ulang (lihat PRD.md §12). */
export const MAX_CONSECUTIVE_OPEN_COMMANDS = 5;

export interface ActuatorHistoryEntry {
  action: ActuatorAction;
  triggeredBy: ActuatorTrigger;
}

export interface SafetyEnvelopeResult {
  /** Command final setelah safety envelope. `null` berarti AI tidak
   * mengeluarkan command sama sekali tick ini (operator sedang override manual). */
  action: ActuatorAction | null;
  overridden: boolean;
  reasoning: string;
}

export function sensorSanityCheck(value: number, bounds: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= bounds.min && value <= bounds.max;
}

/**
 * `recentHistory` diurutkan terbaru-lebih-dulu (most recent first), khusus
 * untuk SATU target (mis. `valve:limbah_jagung` atau `fan`).
 */
export function applySafetyEnvelope(params: {
  desiredAction: ActuatorAction;
  recentHistory: ActuatorHistoryEntry[];
  sensorsOk: boolean;
}): SafetyEnvelopeResult {
  const { desiredAction, recentHistory, sensorsOk } = params;

  const lastEntry = recentHistory[0];
  if (lastEntry?.triggeredBy === "MANUAL") {
    return {
      action: null,
      overridden: true,
      reasoning: "Override manual operator aktif untuk target ini — AI tidak mengambil alih.",
    };
  }

  if (!sensorsOk) {
    return {
      action: FAIL_SAFE_ACTION[desiredAction],
      overridden: true,
      reasoning: "Pembacaan sensor di luar batas wajar (kemungkinan sensor error) — dipaksa ke posisi aman (fail-safe).",
    };
  }

  if (OPEN_FAMILY.has(desiredAction)) {
    let consecutiveOpen = 0;
    for (const entry of recentHistory) {
      if (entry.triggeredBy !== "AI" || !OPEN_FAMILY.has(entry.action)) break;
      consecutiveOpen++;
    }
    if (consecutiveOpen >= MAX_CONSECUTIVE_OPEN_COMMANDS) {
      return {
        action: FAIL_SAFE_ACTION[desiredAction],
        overridden: true,
        reasoning: `Sudah terbuka/menyala ${consecutiveOpen} command AI berturut-turut tanpa jeda — dipaksa tutup untuk verifikasi ulang (batas aman: ${MAX_CONSECUTIVE_OPEN_COMMANDS}).`,
      };
    }
  }

  return { action: desiredAction, overridden: false, reasoning: "" };
}
