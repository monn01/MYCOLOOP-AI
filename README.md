# MYCOLOOP-AI

Software untuk mengontrol dan memonitor Smart Pre-Conditioning Chamber produksi baglog jamur tiram. Lihat `PRD.md` untuk detail produk dan `TASKPLAN.md` untuk urutan pengerjaan per phase. Konvensi kerja untuk Claude Code ada di `CLAUDE.md`.

## Setup

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, NEXTAUTH_SECRET, dst
npx prisma migrate dev # buat schema di database
npm run db:seed        # isi data dummy (2 user, 3 batch contoh)
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Untuk inspeksi database secara visual: `npm run db:studio`.

## Sensor Data Simulator

Karena chamber fisik belum tentu siap saat development (lihat PRD.md §9 dan §12), `scripts/simulate.ts` men-generate data suhu/kelembapan/pH dengan kurva realistis (basah & panas di awal → stabil menjelang siap sterilisasi) dan menginsert-nya ke `SensorReading` secara berkala.

```bash
npm run simulate
```

Tanpa argumen, simulator akan memakai batch dengan status `RUNNING` yang paling baru (atau membuat batch baru otomatis kalau tidak ada), lalu insert satu pembacaan sensor setiap 5 detik.

Opsi yang tersedia:

| Flag | Default | Keterangan |
|---|---|---|
| `--batch <id>` | batch `RUNNING` terbaru | Target batch tertentu (harus berstatus `RUNNING`) |
| `--interval <detik>` | `5` | Jeda nyata antar-insert |
| `--speed <menit>` | `30` | Berapa menit **simulasi** yang maju tiap satu insert — dipakai untuk mempercepat demo tanpa perlu menunggu 48 jam sungguhan |
| `--duration <jam>` | `48` | Total durasi pre-conditioning yang disimulasikan; simulator berhenti otomatis saat tercapai |
| `--anomaly <suhu>` | – | Suntikkan anomali lonjakan suhu untuk testing alert |
| `--anomaly-tick <n>` | tengah proses | Tick keberapa anomali disuntikkan |

Contoh: demo 48 jam proses dipadatkan jadi ~4 menit nyata, dengan satu lonjakan suhu di tengah jalan:

```bash
npm run simulate -- --speed 60 --interval 5 --anomaly suhu
```

Timestamp yang disimpan mengikuti jam simulasi (`startTime + progress`), bukan jam nyata — supaya grafik time-series tetap merepresentasikan garis waktu batch meski dipercepat, dan supaya simulator bisa dihentikan (Ctrl+C) lalu dilanjut lagi tanpa kehilangan progress.

Simulator serupa juga ada untuk Smart Mixing (`npm run simulate:mixing`) dan Smart Incubation (`npm run simulate:incubation`) — insert langsung ke database, dipakai buat tes logic AI tanpa perlu broker MQTT.

## MQTT Bridge (Phase 6a)

`lib/mqtt/bridge.ts` menyambungkan sensor ESP32 (nanti) ke backend lewat broker MQTT — lihat kontrak topic lengkap di komentar file tersebut, atau `PRD.md` §6.2/§7.5. Bisa dites sekarang tanpa hardware fisik pakai broker Mosquitto lokal + "ESP32 palsu":

```bash
# 1. Jalankan broker MQTT lokal (sekali saja, container tetap hidup antar-restart)
docker run -d --name mycoloop-mosquitto -p 1883:1883 \
  -v "$(pwd)/docker/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf" \
  eclipse-mosquitto:2

# 2. Isi MQTT_BROKER_URL="mqtt://localhost:1883" di .env (lihat .env.example)

# 3. Jalankan bridge (subscribe ke topic sensor, publish command aktuator)
npm run mqtt:bridge

# 4. Di terminal lain, jalankan "ESP32 palsu" yang publish data sensor asli lewat MQTT
npm run mock:esp32 -- --stage mixing --interval 1 --speed 20 --duration 4
```

`--stage` menerima `mixing` (default), `pre-conditioning`, atau `incubation`. Data yang masuk lewat bridge diproses AI engine yang sama persis dengan simulator DB-langsung — dashboard/monitor tidak perlu tahu bedanya.
