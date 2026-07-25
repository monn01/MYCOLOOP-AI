/**
 * Stub MQTT subscriber bridge — lihat PRD.md #6 (layer Komunikasi) dan
 * TASKPLAN.md Phase 6. Belum melakukan apa-apa sampai ESP32 + broker MQTT
 * sungguhan tersedia.
 *
 * Saat Phase 6 dikerjakan, ganti isi fungsi ini dengan client `mqtt` yang:
 * 1. Connect ke broker (Mosquitto self-hosted / HiveMQ Cloud, lihat PRD.md #6.2)
 * 2. Subscribe ke topic `chamber/+/sensor`
 * 3. Parse payload lalu insert ke `SensorReading` lewat `prisma` (lib/db/client)
 *    — pola insert-nya sama seperti `scripts/simulate.ts`, jadi endpoint
 *    GET/SSE yang sudah ada di Phase 3 otomatis ikut menampilkan data asli
 *    tanpa perlu diubah.
 */
export async function startMqttBridge() {
  console.log("[mqtt-bridge] Stub aktif — belum terhubung ke broker MQTT sungguhan (Phase 6).");
}
