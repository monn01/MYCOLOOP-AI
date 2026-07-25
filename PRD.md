# PRD.md — MYCOLOOP-AI Software System

## 1. Ringkasan

MYCOLOOP-AI adalah sistem software yang mengontrol dan memonitor **Smart Pre-Conditioning Chamber** untuk produksi baglog jamur tiram dari limbah jagung pascapanen. Software ini menggantikan pendekatan *time-based* (pendiaman media 48 jam tetap) dengan pendekatan *condition-based* — AI menentukan kapan media siap sterilisasi berdasarkan data sensor real-time (suhu, kelembapan, pH).

Dokumen ini fokus pada scope software (dashboard, backend, AI decision logic, integrasi IoT). Alat fisik (mixer, shredder, chamber) di luar scope dokumen ini.

## 2. Masalah yang Diselesaikan

Proses pre-conditioning baglog konvensional mengandalkan waktu tetap (±48 jam) tanpa parameter objektif. Akibatnya: waktu produksi tidak efisien, risiko kontaminasi tinggi, dan kualitas tidak konsisten antar-batch. Software ini menyediakan visibilitas real-time dan pengambilan keputusan otomatis berbasis data untuk mengatasi masalah tersebut.

## 3. Target Pengguna

- **Operator/petani** — mengoperasikan chamber, memantau dashboard, menerima notifikasi kesiapan media.
- **Admin/pemilik UMKM** — melihat riwayat produksi, laporan efisiensi, dan mengelola formula media.

## 4. Tujuan Software

1. Menyediakan monitoring sensor real-time (suhu, kelembapan, pH) dengan latensi rendah (<5 detik dari sensor ke dashboard).
2. Menyediakan AI decision agent yang mengklasifikasikan status kesiapan media: `belum_siap` / `dalam_proses` / `siap_sterilisasi`.
3. Mencatat riwayat setiap batch produksi untuk evaluasi dan continuous improvement.
4. Memberikan notifikasi otomatis ke operator saat media siap atau saat terdeteksi anomali.
5. Menyediakan dashboard yang dapat diakses via web/mobile browser.

## 5. Non-Goals (Di Luar Scope Awal)

- Tidak membangun computer vision untuk deteksi kontaminasi visual (YOLOv8) di MVP — jadi roadmap Phase 2.
- Tidak membangun native mobile app — cukup responsive web dashboard.
- Tidak membangun multi-tenant SaaS — MVP untuk 1 unit chamber/organisasi dulu.

## 6. Arsitektur Sistem

Lima layer:

1. **Edge (Firmware)** — ESP32 membaca sensor DHT22 (suhu/kelembapan) dan sensor pH tiap 30 detik, publish ke MQTT broker, menerima command kontrol aerasi (fan PWM).
2. **Komunikasi** — MQTT broker (Mosquitto self-hosted atau HiveMQ Cloud free-tier) sebagai jembatan real-time antara firmware dan backend.
3. **Backend** — Next.js API routes sebagai MQTT subscriber bridge, REST/tRPC endpoints, dan WebSocket/SSE server untuk push real-time. Prisma ORM + PostgreSQL sebagai penyimpanan data.
4. **AI Engine** — Logic klasifikasi kesiapan media. MVP: rule-based threshold + moving average. Roadmap: model ML (decision tree/random forest) setelah data batch historis terkumpul.
5. **Presentasi** — Dashboard Next.js dengan NextAuth (autentikasi operator), grafik real-time (Recharts), status card AI decision.

## 7. Fitur Utama (MVP)

### 7.1 Dashboard Utama
- Status chamber (`idle` / `running` / `ready`)
- Ringkasan: suhu & pH terkini, estimasi waktu selesai, jumlah batch hari ini
- Alert terbaru dari AI

### 7.2 Pre-Conditioning Monitor
- Grafik time-series suhu, kelembapan, pH real-time
- Threshold line batas aman tiap parameter
- Status AI Decision dengan estimasi waktu tersisa
- Kontrol aerasi manual/otomatis

### 7.3 AI Decision Engine
- Input: suhu, kelembapan, pH (dan turunannya: rate-of-change, moving average)
- Output: status kesiapan + confidence score + alasan singkat
- Anomaly detection: lonjakan suhu, penurunan pH drastis → alert dini

### 7.4 Riwayat Produksi
- Daftar batch dengan durasi, status akhir, grafik sensor per-batch
- Statistik: rata-rata durasi, tingkat keberhasilan, tren efisiensi dari waktu ke waktu

### 7.5 Autentikasi & Manajemen User
- Login operator via NextAuth
- Role: admin vs operator (opsional untuk MVP, bisa single-role dulu)

## 8. Model Data (Ringkasan)

- `Batch` — id, startTime, endTime, status, formula, createdBy
- `SensorReading` — batchId, timestamp, suhu, kelembapan, pH
- `AIDecision` — batchId, timestamp, status, confidence, reasoning
- `Alert` — batchId, timestamp, type (anomaly/ready), message, resolved
- `User` — id, name, email, role

Skema detail dibuat di tahap development menggunakan Prisma schema.

## 9. Requirement Non-Fungsional

- **Real-time**: update dashboard dalam <5 detik dari sensor terbaca.
- **Reliability**: data sensor tetap tersimpan meski dashboard offline (backend selalu subscribe MQTT).
- **Development tanpa hardware**: seluruh software dapat dikembangkan dan diuji menggunakan data simulasi sebelum chamber fisik selesai difabrikasi.
- **Skalabilitas minimal**: cukup untuk 1-5 chamber per instance database di tahap kompetisi.

## 10. Metrik Keberhasilan (untuk Demo/Kompetisi)

- Dashboard dapat menampilkan data sensor simulasi secara real-time tanpa lag.
- AI decision engine memberikan keputusan yang konsisten dengan logika threshold yang telah divalidasi.
- Riwayat batch dapat diakses dan divisualisasikan dengan benar.
- Sistem dapat di-demo end-to-end: dari data sensor masuk → AI memutuskan → notifikasi muncul di dashboard.

## 11. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Backend | Next.js API Routes / Route Handlers |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth |
| Real-time | MQTT (mqtt.js) + WebSocket/SSE |
| Grafik | Recharts |
| Firmware | ESP32 (Arduino/PlatformIO, C++) |
| AI (MVP) | TypeScript rule-based logic |
| AI (Roadmap) | Python (scikit-learn) via microservice FastAPI, dipanggil dari Next.js |

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Chamber fisik belum selesai saat software perlu didemo | Bangun sensor data simulator agar software bisa dites independen dari hardware |
| Model AI belum punya data training | Mulai dengan rule-based, upgrade ke ML setelah data batch terkumpul dari uji coba |
| MQTT broker down/koneksi ESP32 putus | Backend tetap simpan data terakhir, dashboard tampilkan status "disconnected" |
