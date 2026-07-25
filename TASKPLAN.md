# TASKPLAN.md — MYCOLOOP-AI Software System

Urutan pengerjaan disusun agar development tidak terblokir oleh progres alat fisik. Phase 0–4 sepenuhnya bisa dikerjakan lewat Claude Code tanpa hardware. Phase 5 baru butuh ESP32 fisik.

> **Konteks scope:** MYCOLOOP-AI punya 3 stage pipeline produksi (Smart Mixing → Smart Pre-Conditioning → Smart Incubation Monitoring). Seluruh TASKPLAN ini — Phase 0 sampai Phase 8 — scope-nya cuma **Stage 2 (Smart Pre-Conditioning)**. Stage 1 dan Stage 3 belum punya TASKPLAN/PRD sendiri; model data (`Batch.stage`) sudah disiapkan forward-compatible untuk itu, tapi belum ada task pengerjaannya di sini. Detail lihat `PRD.md` §1.1.

---

## Phase 0 — Project Setup

- [x] Scaffold project Next.js 14 (App Router) + TypeScript + Tailwind
- [x] Setup koneksi Prisma (skeleton siap; provisioning DB Neon/Supabase aktual masih perlu dilakukan user — isi `DATABASE_URL` di `.env`)
- [x] Setup struktur folder: `app/`, `lib/`, `components/`, `prisma/`
- [x] Setup `CLAUDE.md` untuk konteks project (stack, konvensi, struktur)
- [x] Init git repo, `.env.example`

## Phase 1 — Data Model (Prisma Schema)

- [x] Definisikan model `Batch`, `SensorReading`, `AIDecision`, `Alert`, `User`
- [x] Jalankan migrasi awal (`prisma migrate dev`) — dijalankan ke Postgres lokal via Docker (`mycoloop-postgres` container); ganti `DATABASE_URL` di `.env` saat pindah ke Neon/Supabase
- [x] Buat seed script untuk data dummy (`prisma/seed.ts`, jalankan via `npm run db:seed`) — 3 batch contoh (COMPLETED/READY/RUNNING) lengkap dengan sensor reading, AI decision, dan alert
- [x] Verifikasi schema — dicek lewat query count/relasi (2 users, 3 batches, 195 sensor readings, 51 AI decisions, 3 alerts, semua konsisten); buka `npm run db:studio` untuk inspeksi visual manual

## Phase 2 — Sensor Data Simulator

- [x] Buat script simulator (`scripts/simulate.ts`, Node.js standalone) yang generate data suhu/kelembapan/pH dengan kurva realistis (basah & panas di awal → stabil menjelang siap), kurva dibagi dengan `prisma/seed.ts` lewat `lib/simulator/curve.ts`
- [x] Simulator insert data ke `SensorReading` tiap beberapa detik (`--interval`) untuk batch yang sedang `RUNNING`, dengan progress yang bisa dipercepat (`--speed`) dan lanjut otomatis kalau dihentikan/dijalankan ulang
- [x] Tambahkan mode simulasi anomali (`--anomaly suhu|ph`) untuk testing alert
- [x] Dokumentasikan cara menjalankan simulator (`npm run simulate`) — lihat README.md

## Phase 3 — Backend: API & Real-time

- [x] Buat API route CRUD `Batch` (create, get, list, update status) — `app/api/batches/route.ts` (GET list + filter status/limit, POST create) dan `app/api/batches/[id]/route.ts` (GET detail, PATCH status/formula/endTime)
- [x] Buat API route GET `SensorReading` (dengan filter batchId, range waktu) — `app/api/sensor-readings/route.ts`, mendukung `batchId` (wajib), `from`/`to`, `limit`
- [x] Setup WebSocket/SSE endpoint untuk push data sensor real-time ke client — `app/api/stream/sensor-readings/route.ts`, polling DB tiap 2 detik lalu push lewat SSE
- [x] (Untuk nanti) siapkan MQTT subscriber bridge — `lib/mqtt/bridge.ts` (stub inert, diisi real MQTT client di Phase 6)
- [x] Testing endpoint dengan data dari simulator Phase 2 — dicek manual via curl (list/filter/create/patch/404/400) dan SSE live-tested sambil `npm run simulate` jalan (event `reading` muncul persis saat simulator insert)

## Phase 4 — AI Decision Engine (Rule-Based)

- [x] Tulis function `evaluateReadiness(readings: SensorReadingInput[]): AIDecisionResult` di `lib/ai/evaluateReadiness.ts`
- [x] Implementasi logic threshold: suhu 25–35°C, pH 6–7, kelembapan 60–65%
- [x] Implementasi moving average & rate-of-change untuk smoothing data noise (window 5 pembacaan, dibandingkan dengan window sebelumnya untuk menilai stabil/masih trending)
- [x] Implementasi anomaly detection (lonjakan suhu tiba-tiba, drop pH drastis) — deteksi delta antar dua pembacaan berurutan
- [x] Buat unit test untuk skenario: media belum siap, media siap, dalam proses, kondisi anomali (suhu & pH) — `lib/ai/evaluateReadiness.test.ts`, 8 test lolos via `npm run test` (Vitest)
- [x] Hubungkan AI engine ke pipeline: setiap data sensor baru masuk → jalankan evaluasi → simpan ke `AIDecision` — `lib/sensors/ingest.ts` jadi titik masuk tunggal (dipakai simulator sekarang, MQTT bridge nanti); anomali & transisi ke siap sterilisasi otomatis bikin `Alert` dan update `Batch.status` ke `READY`

## Phase 5 — Dashboard UI

- [x] Setup NextAuth untuk login operator — Credentials provider (bcrypt vs `User.password`), JWT session dengan `id`/`role`, halaman `/login` custom, middleware proteksi semua halaman non-API. Dites end-to-end (login salah/benar, session, logout) via curl memakai user hasil seed
- [ ] Halaman Dashboard Utama: status chamber, summary cards, alert terbaru
- [ ] Halaman Pre-Conditioning Monitor: grafik time-series (Recharts), threshold line, status AI decision live
- [ ] Halaman Riwayat Produksi: daftar batch, detail per-batch, statistik agregat
- [ ] Notifikasi UI (toast/banner) saat status berubah jadi "siap sterilisasi" atau saat alert anomali muncul
- [ ] Responsive check (mobile/tablet, karena operator mungkin akses dari HP)

## Phase 6 — Integrasi ESP32 (Setelah Hardware Siap)

- [ ] Tulis firmware ESP32: baca sensor tiap 30 detik, publish ke MQTT topic `chamber/{batchId}/sensor`
- [ ] Tulis firmware subscribe ke topic command untuk kontrol fan/aerasi
- [ ] Aktifkan MQTT subscriber bridge di backend (ganti simulator dengan data asli)
- [ ] Kalibrasi sensor (bandingkan pembacaan ESP32 vs alat ukur manual)
- [ ] Uji coba end-to-end dengan chamber fisik: 5–10 batch percobaan

## Phase 7 — Upgrade AI ke Model ML (Roadmap, Setelah Data Batch Terkumpul)

- [ ] Export data historis batch (minimal 20–30 batch) sebagai training set
- [ ] Training model klasifikasi (decision tree/random forest) di Python (scikit-learn)
- [ ] Bangun microservice FastAPI kecil untuk serving model
- [ ] Hubungkan Next.js API ke microservice via HTTP call
- [ ] Bandingkan akurasi model ML vs rule-based sebagai baseline
- [ ] A/B atau fallback: gunakan rule-based jika model ML gagal/tidak tersedia

## Phase 8 — Polish & Demo Prep (Untuk Kompetisi)

- [ ] Siapkan skenario demo end-to-end (data simulasi → AI decision → notifikasi)
- [ ] Rekam video demo cadangan (jaga-jaga koneksi bermasalah saat presentasi)
- [ ] Cek performa: pastikan dashboard tidak lag saat banyak data sensor masuk
- [ ] Review UI/UX terakhir, pastikan konsisten dengan wireframe di proposal

---

## Catatan Prioritas

Phase 0–4 adalah **jalur kritis** yang harus selesai duluan karena semuanya bisa dikerjakan tanpa menunggu tim hardware. Phase 5 (dashboard) bisa paralel dengan Phase 4 begitu API dasar sudah ada. Phase 6 baru dimulai setelah chamber fisik dan ESP32 siap dari tim alat. Phase 7 adalah stretch goal — kerjakan jika waktu memungkinkan sebelum deadline submission, karena akurasi model ML butuh data yang belum tentu cukup di awal.
